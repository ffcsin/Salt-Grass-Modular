const { readStdin, buildContext, write } = require('./lib/io');
const { loadHooksConfig, isEnabled } = require('./lib/config');
const ctx = require('./bumpers/context');
function main() {
  const input = readStdin();
  if (!input) return;
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || '.';
  if (require('./lib/defer').shouldDefer(__dirname, projectDir)) return; // plugin copy defers to repo-local
  const cfg = loadHooksConfig(projectDir);
  // Two complementary injections: the STANDING docs-first + trust-but-verify mandate (every prompt,
  // keeps the discipline alive as CLAUDE.md compresses) + the keyword-specific area router (only on a
  // match). Both fire; the router adds the exact audit paths when the prompt names an area.
  const parts = [];
  if (isEnabled(cfg, 'docsFirstReminder') !== false) parts.push(ctx.docsFirstReminder(projectDir));
  if (isEnabled(cfg, 'promptRouter')) parts.push(ctx.promptRouter(projectDir, input.prompt || ''));
  write(buildContext('UserPromptSubmit', parts.filter(Boolean).join('\n\n')));
}
try { main(); } catch { /* fail-soft */ }
