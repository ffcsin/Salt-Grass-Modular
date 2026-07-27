'use strict';
// Headless CONTRARIAN reviewer agent — lets a hook AUTOMATICALLY spin up a fresh, independent model to
// review a diff, instead of only DIRECTING the main agent to. The point is ADVERSARIAL INDEPENDENCE:
// a different model than the one that wrote the code is far less likely to rubber-stamp its own work.
// Default engine is therefore `grok` (xAI CLI), with `claude` as fallback/opt-in.
//
//   grok:   grok --prompt-file <tmp> --output-format json --tools read_file,grep,list_dir [-m MODEL]
//   claude: claude -p "<prompt>" --output-format json --allowedTools Read Grep Glob [--model X]
//
// Engine selection (first wins): opts.engine → $AGENTIC_OS_REVIEW_ENGINE → 'grok' → fall back to
// whichever CLI is actually installed. Pin with reviewEngine in .ecosystem/hooks-config.json.
//
// GROK GOTCHA (verified 2026-07-27, grok 0.2.112): the grok CLI does NOT read stdin — piping the diff
// yields an empty prompt and a garbage review. The diff must travel in the prompt itself, and it goes
// via --prompt-file (NOT argv) because a 200KB diff blows Windows' 32KB CreateProcess limit.
// `-p/--single` and `--prompt-file` are mutually exclusive — pass --prompt-file alone.
// Its JSON envelope is also its own shape ({text, stopReason, total_cost_usd}), not Claude's
// ({subtype, is_error, result, total_cost_usd}); parseReviewResult handles both.
//
// AUTH: we do NOT pass --bare to claude. --bare skips hooks but ALSO refuses OAuth (demands
// ANTHROPIC_API_KEY) → "Not logged in" for subscription users. So instead recursion is prevented by an
// ENV-VAR guard: we set AGENTIC_OS_REVIEWER=1 before spawning, and every hook dispatcher no-ops when it
// sees it. That keeps the nested reviewer on the user's normal login while guaranteeing it can't
// fork-bomb our hooks. (Same guard is set for grok — harmless, and it still blocks any nested claude.)
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REVIEW_INSTRUCTIONS = [
  'You are an adversarial code reviewer. Review ONLY the changes for REAL,',
  'specific problems: bugs, security holes, data/ledger inconsistency, race conditions, broken contracts,',
  'regressions, and scope creep. You may read/grep surrounding code for context.',
  'Output each finding on its own line as: `SEVERITY | file:line | concise issue`. SEVERITY ∈ High/Med/Low.',
  'Do NOT praise, summarize, or restate the diff, and do NOT write any preamble — begin your reply',
  'directly with the first finding line. If after careful review there are no real issues, reply',
  'with exactly the single word: CLEAN',
].join(' ');
// A finding line: "High | file.js:12 | issue". Used to separate real findings from narration, since
// models sometimes emit a preamble line despite the instruction above.
const FINDING_LINE = /^\s*`?\s*(high|med|medium|low)\s*\|/i;
// Back-compat export: the stdin-flavoured prompt the claude engine uses.
const REVIEW_PROMPT = `A git diff is on stdin. ${REVIEW_INSTRUCTIONS}`;

// Where each engine's binary might live. `grok`'s installer does not always land on PATH (documented
// caveat: add ~/.grok/bin), and hooks inherit a minimal PATH — so probe the canonical install dir too.
// UNKNOWN ENGINE → [] on purpose. Mapping anything-not-grok to claude would make a typo'd
// reviewEngine ("grock") silently fall back to Claude reviewing Claude's own work — precisely the
// non-independence this reviewer exists to prevent. Unknown must fail loudly (no reviewer) instead.
function candidates(engine) {
  if (engine === 'claude') return ['claude'];
  if (engine !== 'grok') return [];
  const home = os.homedir();
  const bin = process.platform === 'win32' ? 'grok.exe' : 'grok';
  return ['grok', path.join(home, '.grok', 'bin', bin)];
}

function binWorks(cmd) {
  try { execFileSync(cmd, ['--version'], { stdio: 'ignore', timeout: 5000 }); return true; } catch { return false; }
}

// Resolve the reviewer to actually spawn → { engine, bin } or null when none is installed.
// An explicitly-requested engine is NEVER silently swapped; only the default falls back.
function resolveReviewer(env = process.env, requested) {
  const pinned = String(requested || env.AGENTIC_OS_REVIEW_ENGINE || '').toLowerCase();
  const order = pinned ? [pinned] : ['grok', 'claude']; // default: contrarian first, claude as fallback
  for (const engine of order) {
    for (const bin of candidates(engine)) if (binWorks(bin)) return { engine, bin };
  }
  return null;
}

// Is an automatic reviewer available + safe to spawn? false when we ARE the nested reviewer (guard),
// when disabled, or when no engine CLI is present.
function reviewerAvailable(env = process.env, requested) {
  if (env.AGENTIC_OS_REVIEWER) return false;     // we're already inside a spawned reviewer → never recurse
  if (env.AGENTIC_OS_NO_AUTOREVIEW) return false; // explicit kill switch
  return !!resolveReviewer(env, requested);
}

// Run the headless reviewer over `diff`. Pure I/O + parse; never throws.
// Returns { ok, clean, findings, cost, engine, error }.
function runDiffReview(root, diff, opts = {}) {
  const timeout = opts.timeoutMs || 180000;
  const r = resolveReviewer(process.env, opts.engine);
  if (!r) return { ok: false, clean: false, findings: '', cost: 0, engine: null, error: 'no reviewer CLI installed' };
  const env = { ...process.env, AGENTIC_OS_REVIEWER: '1' }; // recursion guard for the nested run's hooks
  const common = { cwd: root, encoding: 'utf8', timeout, env, maxBuffer: 64 * 1024 * 1024 };

  if (r.engine === 'grok') {
    let dir;
    try {
      // Diff goes IN the prompt (grok ignores stdin) via a file (dodges the Windows argv cap).
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-os-review-'));
      const file = path.join(dir, 'review-prompt.txt');
      const head = opts.prompt || REVIEW_INSTRUCTIONS;
      fs.writeFileSync(file, `${head}\n\n--- BEGIN GIT DIFF ---\n${String(diff || '')}\n--- END GIT DIFF ---\n`);
      // --tools allowlists read-only builtins, so the reviewer can inspect context but can never edit,
      // write, or shell out — and with no write tools there is nothing that can block on an approval.
      const args = ['--prompt-file', file, '--output-format', 'json', '--tools', 'read_file,grep,list_dir'];
      if (opts.model) args.push('--model', opts.model);
      // stdin ignored on purpose: an unexpected approval prompt fails fast instead of hanging out the timeout.
      const out = execFileSync(r.bin, args, { ...common, stdio: ['ignore', 'pipe', 'ignore'] });
      return { ...parseReviewResult(out), engine: r.engine };
    } catch (e) {
      return { ok: false, clean: false, findings: '', cost: 0, engine: r.engine, error: e.killed ? 'timeout' : String(e.message || e).slice(0, 200) };
    } finally {
      if (dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
    }
  }

  // claude: diff on stdin (its CLI appends piped input to the prompt).
  const args = ['-p', opts.prompt || REVIEW_PROMPT, '--output-format', 'json', '--allowedTools', 'Read', 'Grep', 'Glob'];
  if (opts.model) args.push('--model', opts.model);
  try {
    const out = execFileSync(r.bin, args, { ...common, input: String(diff || ''), stdio: ['pipe', 'pipe', 'ignore'] });
    return { ...parseReviewResult(out), engine: r.engine };
  } catch (e) {
    return { ok: false, clean: false, findings: '', cost: 0, engine: r.engine, error: e.killed ? 'timeout' : String(e.message || e).slice(0, 200) };
  }
}

// Parse either engine's `--output-format json` envelope (split out for testing without a CLI).
//   grok   → { text, stopReason, total_cost_usd }        (no is_error; failures exit nonzero or set .error)
//   claude → { subtype, is_error, result, total_cost_usd }
function parseReviewResult(stdout) {
  let j; try { j = JSON.parse(stdout); } catch { return { ok: false, clean: false, findings: '', cost: 0, error: 'unparseable reviewer output' }; }
  const isGrok = typeof j.text === 'string' && j.result === undefined;
  const text = String((isGrok ? j.text : j.result) || '').trim();
  // grok has no is_error flag: a run is good when it produced text and reported no error. An empty
  // grok reply is a FAILED review, not a clean one (claude's contract kept as-is for back-compat).
  const ok = isGrok ? (!j.error && text !== '') : (j.subtype === 'success' && !j.is_error);
  // Findings are decided by SHAPE, not by position. A reviewer that narrates ("Reviewing the diff…")
  // before saying CLEAN must not be read as a finding — that would block the stop on a clean review.
  // Conversely, real finding lines are extracted so preamble never leaks into the block message.
  const lines = text.split('\n').filter((l) => l.trim());
  const findingLines = lines.filter((l) => FINDING_LINE.test(l));
  let clean;
  if (!ok) clean = false;
  else if (findingLines.length) clean = false;                       // shaped findings → real issues
  else if (/\bCLEAN\b/i.test(text)) clean = true;                    // CLEAN anywhere, preamble tolerated
  else clean = (!isGrok && text === '') || /\bno (real )?(issues|bugs|problems)\b/i.test(text);
  const findings = clean ? '' : (findingLines.length ? findingLines.join('\n') : text);
  return { ok, clean, findings, cost: Number(j.total_cost_usd) || 0, error: ok ? null : (text || j.error || 'reviewer error') };
}

module.exports = { reviewerAvailable, runDiffReview, parseReviewResult, resolveReviewer, REVIEW_PROMPT, REVIEW_INSTRUCTIONS };
