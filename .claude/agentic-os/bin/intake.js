#!/usr/bin/env node
'use strict';
// Parse a GitHub issue into a task scaffold. node bin/intake.js <issue.json|->  (gh issue view N --json number,title,body)
const fs = require('node:fs');
const { parseIssue } = require('../src/intake');
let raw = ''; try { raw = fs.readFileSync(process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : 0, 'utf8'); } catch {}
let issue = {}; try { issue = JSON.parse(raw); } catch { issue = { body: raw }; }
console.log(JSON.stringify(parseIssue(issue), null, 2));
