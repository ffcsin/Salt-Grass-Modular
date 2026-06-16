#!/usr/bin/env node
'use strict';
// Render a run-trace timeline from a session transcript. node bin/trace.js <target> --transcript <path>
const fs = require('node:fs'); const path = require('node:path');
const { readTranscript } = require('../src/budget');
const { transcriptToSpans, renderTimeline } = require('../src/trace');
const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const i = process.argv.indexOf('--transcript'); const tp = i >= 0 ? process.argv[i + 1] : null;
if (!tp) { console.log('usage: --transcript <path>'); process.exit(0); }
const md = renderTimeline(transcriptToSpans(readTranscript(tp)));
const f = path.join(root, '.ecosystem', 'reports', 'run-trace.md'); fs.mkdirSync(path.dirname(f), { recursive: true });
fs.writeFileSync(f, md + '\n'); console.log('wrote ' + f);
