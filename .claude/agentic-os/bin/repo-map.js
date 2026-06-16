#!/usr/bin/env node
'use strict';
// PageRank token-budgeted repo map. Prints the map (and writes .ecosystem/repo-map.md).
// Usage: node bin/repo-map.js <target> [--task "..."] [--budget 1200]
const fs = require('node:fs'); const path = require('node:path');
const { renderRepoMap } = require('../src/repomap');
const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const args = process.argv.slice(2);
const task = (() => { const i = args.indexOf('--task'); return i >= 0 ? args[i + 1] : ''; })();
const budget = (() => { const i = args.indexOf('--budget'); return i >= 0 ? parseInt(args[i + 1], 10) : 1200; })();
const r = renderRepoMap(root, { task, budgetTokens: budget });
const out = path.join(root, '.ecosystem', 'repo-map.md'); fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, r.markdown + '\n');
console.log(r.markdown);
console.error(`\n[repo-map] ${r.files} files, ~${r.tokensUsed} tokens -> ${out}`);
