#!/usr/bin/env node
'use strict';
// Install agentic-os enforcement INTO a repo: copy the hook runtime to <repo>/.claude/agentic-os/ and
// merge the 5 hook events into <repo>/.claude/settings.json (non-destructive + idempotent). After this,
// the ecosystem rules are enforced for all agentic coding in that repo — committed with it, no plugin
// needed. Usage: node bin/install-claude-hooks.js <target> [--regen-patterns] [--force]
//   --regen-patterns  also refresh .ecosystem/extractor.config.json from the current default-patternset
//                     (stack preserved; old config backed up to .bak). Refuses configs carrying
//                     non-default patterns unless --force. Re-run map afterwards to apply.
const path = require('node:path');
const { installRepoHooks } = require('../src/claude-settings');
const pluginRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const root = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const r = installRepoHooks(pluginRoot, root);
const out = { installed: r.runtime, settings: r.settings, events: r.events, mergedWithExisting: r.mergedWithExisting };
if (flags.has('--regen-patterns')) {
  const { regenPatterns } = require('../src/compile');
  // a corrupt config must not crash the CLI after hooks were already installed — report + exit 1
  try {
    out.regenPatterns = regenPatterns(root, { force: flags.has('--force') });
  } catch (e) {
    out.regenPatterns = { regenerated: false, reason: 'error', error: e.message };
  }
  if (out.regenPatterns.reason === 'custom-patterns') {
    console.error('regen-patterns refused: config carries non-default patterns/fileRoutes/globs (re-run with --force to override; .bak will hold the old config):\n  ' + out.regenPatterns.customPatterns.join('\n  '));
  }
  // exit non-zero when the requested regen did not happen (except benign no-op reasons)
  if (!out.regenPatterns.regenerated && !['already-current', 'no-config'].includes(out.regenPatterns.reason)) process.exitCode = 1;
}
console.log(JSON.stringify(out));
