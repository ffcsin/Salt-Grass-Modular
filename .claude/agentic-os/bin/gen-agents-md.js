#!/usr/bin/env node
'use strict';
// Emit/refresh a portable AGENTS.md from the codebase map. Usage: node bin/gen-agents-md.js <target>
const path = require('node:path');
const { writeAgentsMd } = require('../src/agents-md');
let stack = null; try { stack = require('../src/detect').detect(path.resolve(process.argv[2] || '.')); } catch {}
const root = path.resolve(process.argv[2] || '.');
const f = writeAgentsMd(root, { stack });
console.log('wrote ' + f);
