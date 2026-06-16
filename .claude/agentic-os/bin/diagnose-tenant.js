#!/usr/bin/env node
// Per-query tenant-scope verdict: auto-detect the tenant field from the deep-map, then flag DB
// queries that don't scope by it. Advisory.  Usage: node bin/diagnose-tenant.js <target> [tenantField]
const fs = require('node:fs');
const path = require('node:path');
const { auditTenantScope } = require('../src/diagnostics/tenant-scope');
const { detectTenantField } = require('../src/diagnostics/derive-invariants');

const root = path.resolve(process.argv[2] || '.');
let field = process.argv[3];
if (!field) { try { field = detectTenantField(JSON.parse(fs.readFileSync(path.join(root, '.ecosystem', 'deep-map.json'), 'utf8'))); } catch {} }
if (!field) { console.log(JSON.stringify({ tenantField: null, note: 'no tenant field detected — not multi-tenant?' })); process.exit(0); }

const a = auditTenantScope(root, field);
const eco = path.join(root, '.ecosystem', 'reports');
fs.mkdirSync(eco, { recursive: true });
fs.writeFileSync(path.join(eco, 'tenant-scope.md'),
  [`# Tenant-scope verdict — field \`${field}\``, '',
    `_${a.total} DB queries · ${a.scoped} scoped (${(a.scopedRate * 100).toFixed(1)}%) · ${a.unscoped.length} unscoped (review). Advisory — a filter built in a variable can't be resolved here; verify each. Accurate scoping needs data-flow/AST._`, '',
    '## Unscoped (leak candidates)', '',
    ...a.unscoped.slice(0, 500).map((u) => `- \`${u.file}:${u.line}\` — ${u.snippet}`)].join('\n') + '\n');
console.log(JSON.stringify({ tenantField: field, total: a.total, scoped: a.scoped, scopedRatePct: Number((a.scopedRate * 100).toFixed(1)), unscoped: a.unscoped.length }));
