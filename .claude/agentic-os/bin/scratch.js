#!/usr/bin/env node
'use strict';
// Session scratchpad CLI — working memory that survives compaction.
//   node bin/scratch.js note --kind plan --text "..."   |   recall   |   render   |   clear
const path = require('node:path');
const S = require('../src/scratchpad');
const root = path.resolve(process.env.AGENTIC_OS_TARGET || '.');
const [cmd, ...rest] = process.argv.slice(2);
const flag = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : null; };
if (cmd === 'note') { const r = S.note(root, { kind: flag('--kind'), text: flag('--text'), ts: new Date().toISOString() }); console.log(r ? `noted (${r.kind})` : 'skipped'); }
else if (cmd === 'recall') { for (const r of S.recall(root, { kind: flag('--kind') })) console.log(`- (${r.kind}) ${r.text}`); }
else if (cmd === 'render') { console.log(S.render(root) || '(empty)'); }
else if (cmd === 'clear') { S.clear(root); console.log('cleared'); }
else console.log('usage: scratch.js note|recall|render|clear');
