#!/usr/bin/env node
'use strict';
// Agent-effectiveness metrics from git churn. node bin/effectiveness.js <target> [--since "7 days ago"] [--author Claude]
const fs = require('node:fs'); const path = require('node:path');
const { execSync } = require('node:child_process');
const E = require('../src/effectiveness');
const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
let log = ''; try { log = execSync(`git log --since="${flag('--since', '30 days ago')}" --grep="${flag('--author', 'Claude')}" --format=%H^|%an^|%at --numstat`, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).replace(/\^\|/g, '|'); } catch {}
const m = E.churnMetrics(E.parseNumstat(log));
const dir = path.join(root, '.ecosystem', 'reports'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'effectiveness.md'), E.render(m) + '\n');
console.log(JSON.stringify(m));
