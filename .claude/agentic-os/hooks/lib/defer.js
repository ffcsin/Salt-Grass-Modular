'use strict';
// Avoid double-firing: if THIS hook file is the PLUGIN copy (not the repo-local .claude/agentic-os
// copy) AND the target repo has a repo-local install, defer — the repo-local hooks own enforcement.
const path = require('node:path');
function shouldDefer(dirname, projectDir) {
  // RECURSION GUARD: when running INSIDE an agentic-os-spawned headless reviewer (AGENTIC_OS_REVIEWER=1,
  // set by agent-runner before `claude -p`), every hook must no-op — otherwise the reviewer's own Stop
  // hook would spawn ANOTHER reviewer → fork bomb. Load-bearing (we can't use --bare; it breaks OAuth).
  if (process.env.AGENTIC_OS_REVIEWER) return true;
  try {
    const here = String(dirname).replace(/\\/g, '/');
    if (here.includes('.claude/agentic-os/hooks')) return false; // we ARE the repo-local copy → run
    const { repoHooksInstalled } = require('../../src/claude-settings');
    return repoHooksInstalled(projectDir); // plugin copy + repo has its own → defer
  } catch { return false; }
}
module.exports = { shouldDefer };
