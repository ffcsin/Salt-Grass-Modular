#!/usr/bin/env node
'use strict';
// Sanitize/scan a block of untrusted text (web page, MCP response, dependency README) from a file or stdin.
//   node bin/scan-untrusted.js <file>        # prints flags + a safely-wrapped version
const fs = require('node:fs');
const { sanitizeUntrusted } = require('../src/diagnostics/untrusted-content');
const file = process.argv[2];
let text = ''; try { text = file ? fs.readFileSync(file, 'utf8') : fs.readFileSync(0, 'utf8'); } catch {}
const r = sanitizeUntrusted(text, { source: file || 'stdin' });
console.error(JSON.stringify({ flags: r.flags, removedInvisible: r.removedInvisible }));
process.stdout.write(r.wrapped + '\n');
