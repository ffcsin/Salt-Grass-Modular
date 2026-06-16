#!/usr/bin/env node
// Build public-safe contributor profiles from git history into .ecosystem/contributors/.
// Usage: node bin/contributors.js <target> [--since "<git date>"]
const path = require('node:path');
const { buildContributors } = require('../src/contributors');

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const since = args.includes('--since') ? args[args.indexOf('--since') + 1] : '1 year ago';
const { authors, written } = buildContributors(root, { since });
console.log(JSON.stringify({ contributors: authors.length, written: written.length, top: authors.slice(0, 5).map((a) => `${a.name}:${a.commits}`) }));
