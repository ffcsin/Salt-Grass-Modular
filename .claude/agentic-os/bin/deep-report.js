#!/usr/bin/env node
// Write cross-cutting lists + the verify-report (coverage/completeness/accuracy) from the deep-map.
// Reads gate state from .ecosystem/.deep/*. Optional accuracy.json: {sampled, confirmed}.
// Usage: node bin/deep-report.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { writeReports } = require('../src/deep-report');

const root = path.resolve(process.argv[2] || '.');
const eco = path.join(root, '.ecosystem');
const dm = JSON.parse(fs.readFileSync(path.join(eco, 'deep-map.json'), 'utf8'));
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const missing = readJson(path.join(eco, '.deep', 'missing-files.json'), []);
const undercounts = readJson(path.join(eco, '.deep', 'undercount-files.json'), []).map((f) => ({ f }));
const accuracy = readJson(path.join(eco, '.deep', 'accuracy.json'), null);
const expectedCount = (readJson(path.join(eco, '.deep', 'select.json'), { files: [] }).files || []).length || dm.files.length;
const res = writeReports(dm, { missing, undercounts, accuracy, expectedCount }, eco);
console.log(JSON.stringify(res));
