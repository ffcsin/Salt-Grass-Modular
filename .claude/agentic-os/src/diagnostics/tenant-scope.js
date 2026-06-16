// src/diagnostics/tenant-scope.js
// Per-query tenant-scope VERDICT (research: one of the 2 highest-value artifacts almost nobody has).
// For a multi-tenant repo, every DB read should filter by the tenant field; a query that doesn't is a
// cross-tenant leak. This scans DB-query call sites and renders a verdict per query: scoped vs
// unscoped. Heuristic (statement-window check) — advisory, but it pinpoints the exact leak class
// (this repo's documented #1 bug). tenantField comes from detectTenantField (derive-invariants).
const fs = require('node:fs');
const { walk } = require('../../lib/walk');

const QUERY = /\b(find|findOne|findMany|findFirst|updateOne|updateMany|update|deleteOne|deleteMany|delete|aggregate|count|countDocuments|distinct)\s*\(/;
// query sites we DON'T want to flag for tenancy (writes that create the scope, or non-tenant tables)
const SKIP_LINE = /insertOne|insertMany|createMany|migration|\.test\.|\.spec\./;

// For one file, render the per-query verdict. A query is "scoped" if the tenant field appears in its
// statement window — which STOPS at the next query call (so one query's filter can't borrow another's
// tenant field). By-primary-key queries (`_id`) are skipped: a globally-unique id needs no tenant
// scope. Advisory: a variable-built filter (`find(filter)` where filter is assembled elsewhere) can't
// be resolved here — accurate scoping needs data-flow/AST (noted as the precise upgrade).
function scanFileQueries(content, tenantField, opts = {}) {
  const window = opts.window || 5;
  const lines = String(content || '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!QUERY.test(lines[i]) || SKIP_LINE.test(lines[i])) continue;
    // window = this line up to (but not into) the next query call, capped at `window` lines
    let end = i + 1;
    while (end < lines.length && end < i + window && !QUERY.test(lines[end])) end++;
    const win = lines.slice(i, end).join(' ');
    // skip by-primary-key lookups — _id is globally unique, no tenant scope required
    if (/\b_id\b/.test(win) && !win.includes(tenantField)) continue;
    out.push({ line: i + 1, scoped: win.includes(tenantField), snippet: lines[i].trim().slice(0, 100) });
  }
  return out;
}

function auditTenantScope(root, tenantField, opts = {}) {
  if (!tenantField) return { tenantField: null, total: 0, scoped: 0, unscoped: [] };
  const exts = opts.exts || ['.ts', '.js'];
  let files = [];
  try { files = walk(root, { include: exts }); } catch {}
  let total = 0, scoped = 0;
  const unscoped = [];
  const path = require('node:path');
  for (const abs of files) {
    if (/node_modules|\.(test|spec)\.|migration/i.test(abs)) continue;
    let c = ''; try { c = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (!c.includes(tenantField) && !QUERY.test(c)) continue; // quick skip
    for (const q of scanFileQueries(c, tenantField, opts)) {
      total++;
      if (q.scoped) scoped++;
      else unscoped.push({ file: path.relative(root, abs).replace(/\\/g, '/'), line: q.line, snippet: q.snippet });
    }
  }
  return { tenantField, total, scoped, unscoped, scopedRate: total ? scoped / total : 1 };
}

module.exports = { scanFileQueries, auditTenantScope };
