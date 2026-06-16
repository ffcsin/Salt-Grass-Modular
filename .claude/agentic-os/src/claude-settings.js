'use strict';
// Repo-local Claude Code hook installer — the "bake enforcement INTO the repo" path. Running bootstrap
// in any repo copies the hook runtime into <repo>/.claude/agentic-os/ and merges the 5 hook events
// into <repo>/.claude/settings.json, so the ecosystem rules (read-the-audit-before-edit, trust-but-
// verify, schema-fanout, secret-guard, verify-before-done) are ENFORCED for all agentic coding in
// that repo — committed with it, working for anyone who clones, independent of any plugin install.
const fs = require('node:fs');
const path = require('node:path');

// Self-contained runtime: hooks require ../src and ../lib, and the Stop auto-refresh requires
// ../../bin/update-ecosystem (src/deep-merge → ../bin/deep-map likewise). Omitting bin/ shipped a
// copy whose flagship map-stays-live feature silently died on every Stop — caught by the install's
// own stop-hook diagnostic scan on a field repo.
const RUNTIME_DIRS = ['hooks', 'src', 'lib', 'bin'];
const DEST_REL = path.join('.claude', 'agentic-os');
const MARKER = '.claude/agentic-os/hooks/'; // identifies our entries in settings.json (for idempotent re-install)

// The 5 events → repo-relative command. Mirrors hooks/hooks.json.
function hookEntries() {
  const cmd = (f) => `node "${DEST_REL.replace(/\\/g, '/')}/hooks/${f}"`;
  return {
    SessionStart: [{ hooks: [{ type: 'command', command: cmd('session-start.cjs') }] }],
    UserPromptSubmit: [{ hooks: [{ type: 'command', command: cmd('user-prompt.cjs') }] }],
    PreToolUse: [{ matcher: 'Bash|Edit|Write', hooks: [{ type: 'command', command: cmd('pre-tool.cjs') }] }],
    PostToolUse: [{ matcher: 'Edit|Write|Read|WebFetch|WebSearch|mcp__.*', hooks: [{ type: 'command', command: cmd('post-tool.cjs') }] }],
    Stop: [{ hooks: [{ type: 'command', command: cmd('stop.cjs') }] }],
  };
}

const isOurs = (entry) => JSON.stringify(entry).includes(MARKER);

// Merge our hook entries into an existing settings object — idempotent (strips any prior agentic-os
// entries first) and NON-DESTRUCTIVE (keeps the repo's own hooks + all other settings keys).
function mergeSettings(existing, entries) {
  const out = existing && typeof existing === 'object' ? JSON.parse(JSON.stringify(existing)) : {};
  out.hooks = out.hooks || {};
  for (const [event, ourList] of Object.entries(entries)) {
    const prior = (out.hooks[event] || []).filter((e) => !isOurs(e)); // drop our old entries, keep theirs
    out.hooks[event] = [...prior, ...ourList];
  }
  return out;
}

function copyRuntime(pluginRoot, root) {
  const dest = path.join(root, DEST_REL);
  for (const d of RUNTIME_DIRS) {
    const from = path.join(pluginRoot, d);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(dest, d), { recursive: true, filter: (s) => !/[\\/]node_modules[\\/]|[\\/]\.git[\\/]/.test(s) });
  }
  // a small manifest so the plugin copy can detect a repo-local install + defer to it
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'INSTALLED'), 'agentic-os repo-local hook runtime — managed; re-created by bootstrap.\n');
  return dest;
}

function installRepoHooks(pluginRoot, root) {
  copyRuntime(pluginRoot, root);
  const settingsPath = path.join(root, '.claude', 'settings.json');
  let existing = null; try { existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
  const merged = mergeSettings(existing, hookEntries());
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n');
  return { settings: settingsPath, runtime: path.join(root, DEST_REL), events: Object.keys(hookEntries()), mergedWithExisting: !!existing };
}

// Is a repo-local install present? (used by the PLUGIN copy of the hooks to defer + avoid double-fire)
function repoHooksInstalled(root) { try { return fs.existsSync(path.join(root, DEST_REL, 'INSTALLED')); } catch { return false; } }

module.exports = { installRepoHooks, mergeSettings, hookEntries, repoHooksInstalled, isOurs, DEST_REL, MARKER };
