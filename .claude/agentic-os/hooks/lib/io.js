const { readFileSync } = require('node:fs');
function readStdin() { try { return JSON.parse(readFileSync(0, 'utf8')); } catch { return null; } }
function buildContext(eventName, text) {
  if (!text) return null;
  return { hookSpecificOutput: { hookEventName: eventName, additionalContext: text } };
}
function buildDeny(eventName, reason) {
  return { hookSpecificOutput: { hookEventName: eventName, permissionDecision: 'deny', permissionDecisionReason: reason } };
}
// Stop-event BLOCK. The Stop event uses a DIFFERENT shape than PreToolUse: top-level {decision:'block',
// reason} (NOT hookSpecificOutput.permissionDecision). Getting this wrong = the gate silently no-ops
// (it was wrong in stop.cjs + the reference implementation's verification-stop until 2026-06-10). `reason` is shown to the model.
function buildStopBlock(reason) {
  return { decision: 'block', reason: String(reason) };
}
// ASK — Claude Code shows the user an interactive permission popup (reason + Allow/Deny) instead of a
// hard block. `body` should be the full natural-language popup text (build it with describe-op.askBody
// so it reads like "Bumper Bypass Request — about to …"). A bare string is emitted as-is. The
// AGENTIC_OS_OVERRIDE env still bypasses with no popup (headless/scripted).
function buildAsk(eventName, body) {
  return { hookSpecificOutput: { hookEventName: eventName, permissionDecision: 'ask', permissionDecisionReason: String(body) } };
}
function write(obj) { if (obj) process.stdout.write(JSON.stringify(obj)); }
module.exports = { readStdin, buildContext, buildDeny, buildAsk, buildStopBlock, write };
