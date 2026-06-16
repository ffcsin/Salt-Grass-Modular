'use strict';
// Headless reviewer agent — lets a hook AUTOMATICALLY spin up a fresh Claude to review a diff, instead
// of only DIRECTING the main agent to. Uses the `claude` CLI in print mode (verified 2026-06-10):
//   claude -p "<prompt>" --output-format json --allowedTools Read Grep Glob [--model X]
// Real result envelope: { type:'result', subtype:'success'|..., is_error, result:"<text>", total_cost_usd }.
//
// AUTH: we do NOT pass --bare. --bare skips hooks but ALSO refuses OAuth (demands ANTHROPIC_API_KEY) →
// "Not logged in" for subscription users. So instead recursion is prevented by an ENV-VAR guard:
// we set AGENTIC_OS_REVIEWER=1 before spawning, and every hook dispatcher no-ops when it sees it. That
// keeps the nested reviewer on the user's normal login while guaranteeing it can't fork-bomb our hooks.
const { execFileSync } = require('node:child_process');

const REVIEW_PROMPT = [
  'You are an adversarial code reviewer. A git diff is on stdin. Review ONLY the changes for REAL,',
  'specific problems: bugs, security holes, data/ledger inconsistency, race conditions, broken contracts,',
  'regressions, and scope creep. You may use Read/Grep to inspect surrounding code for context.',
  'Output each finding on its own line as: `SEVERITY | file:line | concise issue`. SEVERITY ∈ High/Med/Low.',
  'Do NOT praise, summarize, or restate the diff. If after careful review there are no real issues, reply',
  'with exactly the single word: CLEAN',
].join(' ');

// Is an automatic reviewer available + safe to spawn? false when we ARE the nested reviewer (guard),
// when disabled, or when the CLI is absent.
function reviewerAvailable(env = process.env) {
  if (env.AGENTIC_OS_REVIEWER) return false;     // we're already inside a spawned reviewer → never recurse
  if (env.AGENTIC_OS_NO_AUTOREVIEW) return false; // explicit kill switch
  try { execFileSync('claude', ['--version'], { stdio: 'ignore', timeout: 5000 }); return true; }
  catch { return false; }
}

// Run the headless reviewer over `diff` (piped on stdin). Pure I/O + parse; never throws.
// Returns { ok, clean, findings, cost, error }.
function runDiffReview(root, diff, opts = {}) {
  const timeout = opts.timeoutMs || 180000;
  const args = ['-p', opts.prompt || REVIEW_PROMPT, '--output-format', 'json', '--allowedTools', 'Read', 'Grep', 'Glob'];
  if (opts.model) args.push('--model', opts.model);
  try {
    const out = execFileSync('claude', args, {
      cwd: root, input: String(diff || ''), encoding: 'utf8', timeout,
      env: { ...process.env, AGENTIC_OS_REVIEWER: '1' }, // recursion guard for the nested run's hooks
      maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'],
    });
    return parseReviewResult(out);
  } catch (e) {
    return { ok: false, clean: false, findings: '', cost: 0, error: e.killed ? 'timeout' : String(e.message || e).slice(0, 200) };
  }
}

// Parse the `claude -p --output-format json` envelope (split out for testing without the CLI).
function parseReviewResult(stdout) {
  let j; try { j = JSON.parse(stdout); } catch { return { ok: false, clean: false, findings: '', cost: 0, error: 'unparseable reviewer output' }; }
  const ok = j.subtype === 'success' && !j.is_error;
  const text = String(j.result || '').trim();
  const clean = ok && (/^CLEAN\b/i.test(text) || text === '' || /\bno (real )?(issues|bugs|problems)\b/i.test(text));
  return { ok, clean, findings: clean ? '' : text, cost: Number(j.total_cost_usd) || 0, error: ok ? null : (text || 'reviewer error') };
}

module.exports = { reviewerAvailable, runDiffReview, parseReviewResult, REVIEW_PROMPT };
