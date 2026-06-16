#!/usr/bin/env node
const path = require('node:path');
const { detect } = require('../src/detect');

const root = path.resolve(process.argv[2] || '.');
process.stdout.write(JSON.stringify(detect(root), null, 2) + '\n');
