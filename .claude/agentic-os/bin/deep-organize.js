#!/usr/bin/env node
// Organize the deep-map into the by-project/<area> doc tree + ECOSYSTEM.md.
// Optional per-repo area overrides: .ecosystem/.deep/wrappers.json (array of prefix strings).
// Usage: node bin/deep-organize.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { organize } = require('../src/deep-organize');

const root = path.resolve(process.argv[2] || '.');
const eco = path.join(root, '.ecosystem');
const dm = JSON.parse(fs.readFileSync(path.join(eco, 'deep-map.json'), 'utf8'));
let opts = {};
try { opts.wrappers = JSON.parse(fs.readFileSync(path.join(eco, '.deep', 'wrappers.json'), 'utf8')); } catch {}
const res = organize(dm, eco, opts);
console.log(JSON.stringify({ projects: res.projects.length, areas: res.projects.reduce((n, p) => n + p.areas, 0) }));
