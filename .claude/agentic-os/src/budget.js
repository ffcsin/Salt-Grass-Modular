'use strict';
// Token/cost budget guard. Parses cumulative token usage from the Claude Code session transcript
// (JSONL) and enforces a configurable ceiling — pause+escalate, not just log. Parallel agent teams
// burn ~7× tokens, so a budget is mandatory before fan-out. Zero deps (reads the transcript file).
const fs = require('node:fs');
const path = require('node:path');

// Sum input+output tokens across assistant messages in a transcript (array of parsed JSONL objects).
function sumUsage(entries) {
  let input = 0, output = 0, cacheRead = 0;
  for (const e of entries || []) {
    const u = (e && e.message && e.message.usage) || e.usage;
    if (!u) continue;
    input += u.input_tokens || 0;
    output += u.output_tokens || 0;
    cacheRead += u.cache_read_input_tokens || 0;
  }
  return { input, output, cacheRead, total: input + output };
}

function readTranscript(transcriptPath) {
  try {
    return fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

// Check spend vs a limit. limit in tokens. Returns {spent, limit, ratio, over, warn}.
function checkBudget(spent, limit, { warnAt = 0.8 } = {}) {
  if (!limit || limit <= 0) return { spent, limit: 0, ratio: 0, over: false, warn: false };
  const ratio = spent / limit;
  return { spent, limit, ratio, over: ratio >= 1, warn: ratio >= warnAt };
}

// Load the configured budget from .ecosystem/budget.json ({ tokenLimit, warnAt }).
function loadBudget(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, '.ecosystem', 'budget.json'), 'utf8')); } catch { return null; }
}

// Convenience for a hook: returns a nudge string or null.
function budgetNudge(root, transcriptPath) {
  const cfg = loadBudget(root); if (!cfg || !cfg.tokenLimit) return null;
  const usage = sumUsage(readTranscript(transcriptPath));
  const r = checkBudget(usage.total, cfg.tokenLimit, { warnAt: cfg.warnAt || 0.8 });
  if (r.over) return `[agentic-os] ⛔ Token budget exceeded: ${usage.total.toLocaleString()} / ${cfg.tokenLimit.toLocaleString()} (${(r.ratio * 100).toFixed(0)}%). Pause and confirm scope before continuing.`;
  if (r.warn) return `[agentic-os] Token budget at ${(r.ratio * 100).toFixed(0)}% (${usage.total.toLocaleString()}/${cfg.tokenLimit.toLocaleString()}).`;
  return null;
}

module.exports = { sumUsage, readTranscript, checkBudget, loadBudget, budgetNudge };
