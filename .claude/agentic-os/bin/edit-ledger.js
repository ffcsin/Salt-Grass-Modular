#!/usr/bin/env node
'use strict';
// Render the human-readable edit ledger from the machine edit log (.ecosystem/audit-log.jsonl).
const path = require('node:path');
const { renderLedger } = require('../src/edit-ledger');
const root = path.resolve(process.env.AGENTIC_OS_TARGET || process.argv[2] || '.');
try { console.log('wrote ' + renderLedger(root)); }
catch (e) { console.error('edit-ledger failed:', e.message); process.exit(1); }
