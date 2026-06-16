#!/usr/bin/env node
'use strict';
// Write the "what changed & why" session report. node bin/session-report.js <target> [--transcript <path>]
const path = require('node:path');
const { writeSessionReport } = require('../src/session-report');
const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const i = process.argv.indexOf('--transcript');
console.log('wrote ' + writeSessionReport(root, { transcriptPath: i >= 0 ? process.argv[i + 1] : null }));
