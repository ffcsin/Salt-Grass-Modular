#!/usr/bin/env node
'use strict';
// Thin sandbox runner — execute a command in an ephemeral, env-scrubbed, timeout-bounded temp dir.
// ⚠ Safety net (catches crashes/hangs/stray writes), NOT a security boundary.
//   node bin/mutation-and-sandbox.js --cmd "node -e \"console.log(1)\"" [--timeout 10000]
const { runSandboxed } = require('../src/verify/sandbox');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const cmd = flag('--cmd');
if (!cmd) { console.log('usage: --cmd "<command>" [--timeout ms]'); process.exit(0); }
const r = runSandboxed(cmd, { timeoutMs: parseInt(flag('--timeout', '10000'), 10) });
console.log(JSON.stringify({ ok: r.ok, exitCode: r.exitCode, timedOut: r.timedOut, stdout: r.stdout.slice(0, 500), error: r.error }, null, 2));
process.exit(r.ok ? 0 : 1);
