#!/usr/bin/env node
'use strict';
// BM25 code search + context pack from the CLI (also exposed as MCP tools).
//   node bin/retrieve.js <target> --query "magic link auth"
//   node bin/retrieve.js <target> --pack src/auth/jwt.ts
const path = require('node:path');
const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const query = flag('--query'), pack = flag('--pack');
if (pack) {
  const { renderContextPack } = require('../src/context-pack');
  console.log(renderContextPack(root, pack).markdown);
} else if (query) {
  const { buildIndex, search } = require('../src/retrieval/bm25');
  const hits = search(buildIndex(root), query, { limit: 12 });
  console.log(`# BM25 results for: ${query}\n`);
  for (const h of hits) console.log(`- ${h.file}  (${h.score.toFixed(2)})`);
} else {
  console.log('usage: bin/retrieve.js <target> --query "..."  |  --pack <file>');
}
