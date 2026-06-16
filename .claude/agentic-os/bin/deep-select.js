#!/usr/bin/env node
// Select API-bearing files, size-batch them by workspace, and emit the initial sweep workflow.
// Usage: node bin/deep-select.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { selectDeep } = require('../src/deep-select');
const { genSweepScript } = require('../src/deep-scripts');

const root = path.resolve(process.argv[2] || '.');
const { files, batches, byWorkspace } = selectDeep(root);
const deep = path.join(root, '.ecosystem', '.deep');
fs.mkdirSync(deep, { recursive: true });
fs.writeFileSync(path.join(deep, 'select.json'), JSON.stringify({ files, batches, byWorkspace }, null, 2));
const sweepScript = genSweepScript(batches, path.join(deep, 'sweep.js'));
console.log(JSON.stringify({ files: files.length, batches: batches.length, workspaces: Object.keys(byWorkspace).length, sweepScript }));
