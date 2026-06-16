const { readStdin, buildStopBlock, write } = require('./lib/io');
const { loadHooksConfig, isEnabled } = require('./lib/config');
const { currentRole, gateSeverity } = require('./lib/role');
const proc = require('./bumpers/process');
const tr = require('./lib/transcript');
const fs = require('node:fs'); const path = require('node:path');
// Circuit breaker (review C2): hard-cap self-critique blocks per session so a missing/false
// stop_hook_active can NEVER infinite-trap a user (esp. a non-dev with no bypass knowledge). Returns
// true while still allowed to block; flips to false after MAX, then the gate fails OPEN (soft nudge).
const MAX_CRITIQUE_BLOCKS = 2;
function critiqueBlockAllowed(projectDir, sessionId) {
  const f = path.join(projectDir, '.ecosystem', '.self-critique-blocks.json');
  let st = { session: '', count: 0 };
  try { st = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  if (st.session !== sessionId) st = { session: sessionId, count: 0 }; // new session → reset
  if (st.count >= MAX_CRITIQUE_BLOCKS) return false;
  st.count++;
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(st)); } catch {}
  return true;
}
// Auto-review marker: ms timestamp of the last CLEAN headless review. A clean review counts toward the
// gate (so it doesn't re-fire on the same unchanged diff); a later edit (newer ts) re-arms it.
const AR_MARK = (projectDir) => path.join(projectDir, '.ecosystem', '.autoreview-ok');
function autoReviewTs(projectDir) { try { return Number(fs.readFileSync(AR_MARK(projectDir), 'utf8').trim()) || 0; } catch { return 0; } }
function markAutoReview(projectDir) { try { fs.mkdirSync(path.join(projectDir, '.ecosystem'), { recursive: true }); fs.writeFileSync(AR_MARK(projectDir), String(nowMs())); } catch {} }
// nowMs without Date.now (unavailable in some sandboxes? — here it's fine; agent-runner uses real time).
function nowMs() { try { return Date.parse(new Date().toISOString()); } catch { return 0; } }
// Spin up the headless reviewer over the working-tree diff. Returns {ran, clean, findings, cost} or
// {ran:false}. Bounded: skips when the CLI is absent, the diff is empty, or the diff is too large.
function runAutoReview(projectDir, cfg) {
  try {
    const { reviewerAvailable, runDiffReview } = require('../src/agent-runner');
    if (!reviewerAvailable()) return { ran: false };
    let diff = '';
    try { diff = require('node:child_process').execFileSync('git', ['diff', '--no-color', 'HEAD'], { cwd: projectDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch {}
    if (!diff.trim()) { try { diff = require('node:child_process').execFileSync('git', ['diff', '--no-color'], { cwd: projectDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch {} }
    const cap = cfg.reviewDiffCapBytes || 200000; // ~200KB; bigger diffs → skip (slow/expensive), use directive
    if (!diff.trim() || diff.length > cap) return { ran: false };
    const r = runDiffReview(projectDir, diff, { model: cfg.reviewModel || undefined, timeoutMs: cfg.reviewTimeoutMs || 180000 });
    if (!r.ok) return { ran: false };
    return { ran: true, clean: r.clean, findings: r.findings, cost: r.cost };
  } catch { return { ran: false }; }
}
function main() {
  const input = readStdin() || {};
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || '.';
  if (require('./lib/defer').shouldDefer(__dirname, projectDir)) return; // plugin copy defers to repo-local
  const cfg = loadHooksConfig(projectDir);
  // Loop guard: if this Stop is already a continuation forced by a prior Stop-hook block, do NOT block
  // again (would trap the agent). Emit only soft reminders. (Claude Code sets stop_hook_active on the
  // re-entry.) The override env also disables blocking.
  const blocking = !input.stop_hook_active && !process.env.AGENTIC_OS_OVERRIDE;

  // Verify-before-done gate (correct Stop shape: top-level decision:block — the old hookSpecificOutput
  // form silently no-op'd). 'ask' has no popup on Stop, so it degrades to a soft nudge; 'block' denies.
  if (blocking && cfg.enforceVerifyBeforeDone && input.transcript_path) {
    const g = proc.checkVerifyGate(tr.lastAssistantText(input.transcript_path), tr.recentToolCalls(input.transcript_path, 30));
    if (g.triggered) {
      if (gateSeverity(cfg.enforceVerifyBeforeDone, currentRole(cfg), cfg) === 'block') { write(buildStopBlock(g.reason)); return; }
      process.stdout.write(g.reason); return; // ask/warn → soft nudge (no popup surface on Stop)
    }
  }

  // Self-critique GATE — the documented #1 leverage guardrail (independent review before "done").
  // Mandated by default: BLOCKS the stop when the session edited code, claims done, and no independent
  // review ran AFTER the last edit. All session-derived from the transcript (no stale forever-file).
  // The circuit breaker caps blocks/session so it can never infinite-trap a user.
  if (blocking && cfg.enforceSelfCritique !== false && input.transcript_path) {
    const g = proc.checkSelfCritiqueGate(tr.lastAssistantText(input.transcript_path), tr.recentToolCalls(input.transcript_path, 200), autoReviewTs(projectDir));
    if (g.triggered) {
      const hard = gateSeverity(cfg.selfCritiqueEnforce, currentRole(cfg), cfg) !== 'warn';
      // AUTO-REVIEW (the ask): instead of just DIRECTING the agent to review, SPIN UP a headless
      // reviewer agent on the diff right now. CLEAN → the gate is satisfied automatically (proceed, no
      // block consumed). Issues → block with the actual findings. Only runs when the gate fires (bounded).
      if (cfg.autoReview !== false) {
        const r = runAutoReview(projectDir, cfg);
        if (r && r.ran && r.clean) { markAutoReview(projectDir); process.stdout.write(`[agentic-os] Auto-review agent inspected your diff — CLEAN (cost $${r.cost.toFixed(3)}). ✓`); return; }
        if (r && r.ran && r.findings) {
          if (hard && critiqueBlockAllowed(projectDir, input.session_id || '')) { write(buildStopBlock(`[agentic-os] An automatic reviewer agent inspected your changes and found issues — FIX these (or refute each) before finishing:\n\n${r.findings}\n\n(headless review, cost $${r.cost.toFixed(3)}; re-runs after you edit again)`)); return; }
          process.stdout.write(`[agentic-os] Auto-review found issues (advisory):\n${r.findings}`); return;
        }
        // reviewer unavailable / errored → fall through to the directive block (still enforced)
      }
      if (hard && critiqueBlockAllowed(projectDir, input.session_id || '')) { write(buildStopBlock(g.reason)); return; }
      process.stdout.write(g.reason); return; // warn mode OR breaker tripped → soft nudge, never trap
    }
  }

  // Automatic learning capture (write side of the learning loop): scrape LEARNING(...) markers from
  // this session's agent text + new fix()/feat() commits → repo learnings; LEARNING(user)/USER-LEARNING
  // → the GLOBAL profile (cross-repo). Deterministic, free, fail-soft.
  let learnNote = '';
  if (isEnabled(cfg, 'autoLearn') !== false && input.transcript_path) {
    try {
      const r = require('../src/auto-learn').captureSession(projectDir, tr.allAssistantText(input.transcript_path), require('./lib/profile'));
      if (r.repo || r.user) learnNote = `[agentic-os] Auto-learned ${r.repo} repo + ${r.user} cross-repo user fact(s) this session.`;
    } catch {}
  }

  // Soft reminders
  const parts = [];
  if (learnNote) parts.push(learnNote);
  // Diagnostic bug-finder: deterministic scanners (store-consistency / async / hallucinated-import) over
  // the session's changed files. Cheap, no LLM, surfaces the high-value bug classes as an advisory.
  if (isEnabled(cfg, 'diagnosticScan') !== false) { try { parts.push(require('../src/diagnostics/changed-scan').diagnoseChanged(projectDir)); } catch {} }
  if (isEnabled(cfg, 'stopVerify')) parts.push(proc.stopVerify());
  // selfCritique nudge only fires here when the GATE is OFF (enforceSelfCritique:false) but the nudge
  // is still wanted — otherwise the gate above already handled it (block or warn). Avoids double-firing.
  if (cfg.enforceSelfCritique === false && isEnabled(cfg, 'selfCritique') !== false && input.transcript_path) {
    parts.push(proc.selfCritiqueNudge(tr.lastAssistantText(input.transcript_path), tr.recentToolCalls(input.transcript_path, 200)));
  }
  if (isEnabled(cfg, 'budgetGuard') !== false && input.transcript_path) { try { parts.push(require('../src/budget').budgetNudge(projectDir, input.transcript_path)); } catch {} }
  if (isEnabled(cfg, 'autoRefresh')) parts.push(proc.autoRefresh(projectDir));
  if (isEnabled(cfg, 'stopRemapNet')) parts.push(proc.stopRemapNet(projectDir));
  if (isEnabled(cfg, 'ciAutoMaintain') !== false) { try { parts.push(require('../src/ci-maintain').ciDirtyNudge(projectDir)); } catch {} }
  const text = parts.filter(Boolean).join('\n');
  if (text) process.stdout.write(text);
}
try { main(); } catch { /* fail-soft */ }
