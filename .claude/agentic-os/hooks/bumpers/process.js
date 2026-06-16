const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// ── pre-push preflight gate ───────────────────────────────────────────────
// Intercept `git push` and require that /agentic-os:preflight ran-and-passed FOR THIS EXACT COMMIT before
// the code leaves the machine — so the same GH/GL checks run LOCALLY first and you fix failures before
// they hit the server. preflight writes the current HEAD sha to .ecosystem/.preflight-ok on PASS; this
// gate compares it to the live HEAD (new commits since → stale → re-run). Hooks can't invoke a skill, so
// the gate ASKS/blocks the push and tells the agent to run preflight; the deterministic git pre-push hook
// remains the human-side backstop.
const PUSH_RE = /(^|[\s;&|(])git\s+(?:-\S+\s+|--\S+\s+)*push\b/;
function gitHead(projectDir) {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}
function gitPushGate(projectDir, command) {
  const c = String(command || '');
  if (!PUSH_RE.test(c)) return { triggered: false };
  if (/--dry-run\b|--help\b|\bgit\s+push\s+(?:\S+\s+)*--delete\b/.test(c)) return { triggered: false }; // dry-run/help/branch-delete don't need preflight
  let markerHead = null;
  try { markerHead = fs.readFileSync(path.join(projectDir, '.ecosystem', '.preflight-ok'), 'utf8').trim(); } catch {}
  const head = gitHead(projectDir);
  if (markerHead && head && markerHead === head) return { triggered: false }; // preflight already green for this exact commit
  const why = !markerHead ? 'preflight has not passed for this checkout' : 'there are new commits since preflight last passed';
  return { triggered: true, reason: `[agentic-os] Pre-push gate — about to \`git push\`, but ${why}. Run /agentic-os:preflight FIRST: it runs your GitHub/GitLab checks LOCALLY (map-drift critique + gate pack + imported-CI mirror), so you diagnose & fix failures before they reach the server. Then push. (Bypass once: AGENTIC_OS_OVERRIDE=1 git push — the deterministic git pre-push hook still runs the gate pack.)` };
}

function stopVerify() {
  return '[agentic-os] Before declaring done: run superpowers:verification-before-completion (tests pass? claims verified against code?).';
}
function stopRemapNet(projectDir) {
  try {
    // Keep the human edit-ledger fresh for free (tiny write, no agents).
    try { require('../../src/edit-ledger').renderLedger(projectDir); } catch {}
    const arr = JSON.parse(fs.readFileSync(path.join(projectDir, '.ecosystem', '.session-edits.json'), 'utf8'));
    if (arr && arr.length) return `[agentic-os] You edited ${arr.length} mapped file(s) this session — run /agentic-os:preflight (re-extracts + critiques) before pushing, or enable hooks-config "autoRefresh" to keep the structural map live automatically.`;
  } catch {}
  return null;
}
// Opt-in: actually refresh the DETERMINISTIC ecosystem on Stop (free — no agents). Re-maps
// routes/guards/params/orphans + re-renders the human views. The semantic deep re-extract stays at preflight.
function autoRefresh(projectDir) {
  try {
    if (!fs.existsSync(path.join(projectDir, '.ecosystem', 'extractor.config.json'))) return null;
    let dirty = []; try { dirty = JSON.parse(fs.readFileSync(path.join(projectDir, '.ecosystem', '.dirty.json'), 'utf8')); } catch {}
    if (!dirty.length) return null;
    require('../../bin/update-ecosystem').main(projectDir, { full: false }); // light: structural only on Stop; catalogs+audits refresh at preflight
    return `[agentic-os] Auto-refreshed the structural map (${dirty.length} changed file(s)). Run /agentic-os:preflight for catalog/audit refresh + the semantic deep re-extract before pushing.`;
  } catch { return null; }
}
const CLAIM = /\b(all done|done|fixed|works now|should work|complete|finished|ready|all set|that should do it)\b/i;
const TEST_CMD = /\b(node --test|npm (run )?test|pytest|jest|vitest|go test|cargo test|mvn test|rspec)\b/i;
const VERIFY_SKILL = /(ecosystem-review|verification-before-completion|requesting-code-review)/i;
function checkVerifyGate(assistantText, toolCalls) {
  if (!CLAIM.test(assistantText || '')) return { triggered: false };
  const verified = (toolCalls || []).some((c) =>
    (c.command && TEST_CMD.test(c.command)) || (c.skill && VERIFY_SKILL.test(c.skill)) || (c.name && VERIFY_SKILL.test(c.name)));
  if (verified) return { triggered: false };
  return { triggered: true, reason: '[agentic-os] Completion claimed without verification. Run tests or /agentic-os:ecosystem-review (or superpowers:verification-before-completion) before finishing.' };
}
// Fresh-eyes self-critique nudge: the 2026 verification-bottleneck pattern — "the agent that wrote
// the code shouldn't be the only one to grade it." Fires on a completion claim when no independent
// critique (ecosystem-review / requesting-code-review) ran this session. Warn-level (complements the
// blocking verify gate, which accepts tests alone).
const CRITIQUE_SKILL = /(ecosystem-review|requesting-code-review|code-reviewer|code-review)/i;
const EDIT_TOOL = /^(Edit|Write|MultiEdit|NotebookEdit)$/;
// A Task/subagent counts as a REVIEW only if its intent says so — a search/build subagent is NOT a
// review (review H1: "any Task trivially satisfied the gate"). Review skills always count.
const REVIEW_INTENT = /(review|critique|adversaria|audit|grade|red.?team|find (bugs|issues|problems))/i;
function isReviewCall(c) {
  if (!c) return false;
  if (c.skill && CRITIQUE_SKILL.test(c.skill)) return true;
  if (c.name && CRITIQUE_SKILL.test(c.name)) return true;
  if (c.name && /^(Task|Agent)$/.test(c.name)) return REVIEW_INTENT.test(c.desc || '');
  return false;
}
// Tightened completion-claim detector (review H3: bare "done/ready/complete" mid-sentence false-blocked).
// Requires a claim-SHAPED phrase, not just a high-frequency word; the LAST assistant text only.
// Multi-word, claim-SHAPED phrases (specific enough to be unambiguous completion claims anywhere in
// the text) — NOT bare "done"/"ready"/"complete" which fire mid-work. `done[.!]` needs punctuation so
// "I'm done." fires but "done with X" doesn't.
const STRONG_CLAIM = /(all done|done[.!]|that should (do it|be it)|fixed it\b|all set\b|shipped it\b|task (is (now )?)?complete|ready to (ship|merge|test|review|go)|it works now|works now\b|good to go\b|all finished\b)/i;
const NEGATED = /\b(not|isn'?t|aren'?t|won'?t|can'?t|never|almost|nearly|not yet)\b[^.!?]{0,30}(done|finished|complete|ready|works|fixed)/i;
function claims(text) { const t = String(text || ''); return STRONG_CLAIM.test(t) && !NEGATED.test(t); }

// Did the session edit code, and was the most recent edit followed by an independent review? (review
// H2/H4: edits + review must share a horizon and the review must come AFTER the last edit; recomputing
// both from the same transcript scan also kills the stale-forever-file false-block, review C1.)
// autoReviewTs (ms, optional) = when an automatic headless reviewer last passed CLEAN — counts as a
// review at that time, so a clean auto-review satisfies the gate without a transcript tool-call.
function reviewAfterLastEdit(toolCalls, autoReviewTs) {
  const calls = toolCalls || [];
  let lastEdit = -1, lastReview = -1;
  for (const c of calls) {
    const name = c.name || '';
    const ts = typeof c.ts === 'number' ? c.ts : 0;
    if (EDIT_TOOL.test(name)) lastEdit = Math.max(lastEdit, ts || 1); // ts 0 → use 1 so "exists" is truthy
    if (isReviewCall(c)) lastReview = Math.max(lastReview, ts || 1);
  }
  if (typeof autoReviewTs === 'number' && autoReviewTs > 0) lastReview = Math.max(lastReview, autoReviewTs);
  return { edited: lastEdit > -1, reviewedAfter: lastReview > -1 && lastReview >= lastEdit };
}

function selfCritiqueNudge(assistantText, toolCalls) {
  if (!claims(assistantText)) return null;
  const { edited, reviewedAfter } = reviewAfterLastEdit(toolCalls);
  if (!edited || reviewedAfter) return null;
  return '[agentic-os] Fresh-eyes check: before finishing work you wrote, run /agentic-os:ecosystem-review (or superpowers:requesting-code-review) for an INDEPENDENT critique — the agent that wrote the code should not be the only one to grade it.';
}
// Self-critique GATE (the documented #1 leverage guardrail). BLOCKS completion when the session edited
// code, claims done, and no independent review ran AFTER the last edit. Satisfied by a review skill or
// a review-intent reviewer sub-agent. Everything is derived from the transcript (session-scoped).
function checkSelfCritiqueGate(assistantText, toolCalls, autoReviewTs) {
  if (!claims(assistantText)) return { triggered: false };
  const { edited, reviewedAfter } = reviewAfterLastEdit(toolCalls, autoReviewTs);
  if (!edited || reviewedAfter) return { triggered: false };
  return { triggered: true, reason: '[agentic-os] Self-critique gate: you claimed completion on code you wrote this session, but NO independent review ran AFTER your last edit (writer ≠ grader — the 2026 verification bottleneck). Before finishing, spawn a fresh reviewer sub-agent (Task tool, prompt it to "adversarially REVIEW my diff for bugs/security/regressions") OR run /agentic-os:ecosystem-review (or superpowers:requesting-code-review). Then address what it finds. Bypass once: AGENTIC_OS_OVERRIDE=1; disable: hooks-config enforceSelfCritique=false.' };
}
// Back-compat alias for callers/tests that expect a boolean "was there a review".
function hadIndependentReview(toolCalls) { return (toolCalls || []).some(isReviewCall); }
module.exports = { stopVerify, stopRemapNet, autoRefresh, checkVerifyGate, selfCritiqueNudge, checkSelfCritiqueGate, hadIndependentReview, isReviewCall, reviewAfterLastEdit, gitPushGate };
