#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { saveConfig } = require('../src/compile');

const root = path.resolve(process.argv[2] || '.');
const psPath = process.argv[3];
if (!psPath) { console.error('usage: compile.js <target> <patternset.json>'); process.exit(2); }

let ps;
try { ps = JSON.parse(fs.readFileSync(psPath, 'utf8')); }
catch (e) { console.error('cannot read patternset:', e.message); process.exit(2); }

try { console.log('saved', saveConfig(root, ps)); }
catch (e) { console.error('invalid PatternSet:', e.message); process.exit(1); }
