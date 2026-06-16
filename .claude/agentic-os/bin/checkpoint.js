#!/usr/bin/env node
'use strict';
// Checkpoint/resume a long-horizon task. save: snapshot milestone. resume: print the latest.
//   node bin/checkpoint.js <target> save --label "..." [--remaining "a;b"] [--done "x"]
//   node bin/checkpoint.js <target> resume
const path = require('node:path');
const { execSync } = require('node:child_process');
const C = require('../src/checkpoint');
const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const cmd = process.argv[3] || 'resume';
const args = process.argv.slice(3);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const list = (s) => (s ? s.split(';').map((x) => x.trim()).filter(Boolean) : []);
if (cmd === 'save') {
  let ref = ''; try { ref = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim(); } catch {}
  C.saveCheckpoint(root, { label: flag('--label') || 'checkpoint', gitRef: ref, done: list(flag('--done')), remaining: list(flag('--remaining')), decisions: list(flag('--decisions')), notes: flag('--notes') || '', ts: new Date().toISOString() });
  console.log('checkpoint saved');
} else { console.log(C.renderResume(root) || '(no checkpoints)'); }
