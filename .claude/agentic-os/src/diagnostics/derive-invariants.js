// src/diagnostics/derive-invariants.js
// Turn the deep-map's LEARNED conventions into enforceable repo invariants. The flagship one is
// tenant-scoping ("every DB query scopes by <tenantField>") — auto-derived from the glossary +
// findings, then emitted as (a) an executable .ecosystem/checks/ script (runs in preflight/CI, no
// external tool) and (b) a Semgrep rule for teams that have Semgrep. This is the "almost nobody has
// it" item: repo-SPECIFIC rules derived from the codebase's own observed patterns, not generic OWASP.

const TENANT_HINTS = ['locationid', 'tenantid', 'orgid', 'organizationid', 'workspaceid', 'accountid', 'companyid'];

// Detect the repo's tenant field from glossary conventions + observed route/call params.
function detectTenantField(deepMap) {
  // 1) glossary convention that names scoping/tenancy
  for (const g of deepMap.glossary || []) {
    const hay = `${g.name || ''} ${g.evidence || ''}`.toLowerCase();
    if (/tenant|multi-tenant|scop|isolation/.test(hay)) {
      for (const h of TENANT_HINTS) if (hay.includes(h)) return canonical(h);
    }
  }
  // 2) most-common tenant-like param across routes (path/query/body)
  const counts = {};
  for (const f of deepMap.files || []) for (const e of f.exposesEndpoints || []) {
    for (const ch of ['path', 'query', 'body']) for (const p of namesOf(e.params && e.params[ch])) {
      if (TENANT_HINTS.includes(String(p).toLowerCase())) counts[p] = (counts[p] || 0) + 1;
    }
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}
function canonical(h) { return { locationid: 'locationId', tenantid: 'tenantId', orgid: 'orgId', organizationid: 'organizationId', workspaceid: 'workspaceId', accountid: 'accountId', companyid: 'companyId' }[h] || h; }
function namesOf(v) { return Array.isArray(v) ? v.map((x) => typeof x === 'string' ? x : (x && x.name) || '') : (v && typeof v === 'object' ? Object.keys(v) : []); }

function deriveInvariants(deepMap) {
  const invariants = [];
  const tenant = detectTenantField(deepMap);
  if (tenant) invariants.push({
    id: 'tenant-scoping', field: tenant,
    description: `Multi-tenant repo: every DB query should scope by \`${tenant}\`. Flags query call sites where \`${tenant}\` does not appear in the same statement.`,
  });
  return invariants;
}

// Executable check script (CommonJS) for .ecosystem/checks/ — greps source for DB-query call sites
// lacking the tenant field. Heuristic + advisory (exit 0 with a count; flip EXIT_ON_VIOLATION=1 to gate).
function checkScript(inv) {
  return `#!/usr/bin/env node
// agentic-os derived invariant: ${inv.id} — generated. Flags DB queries missing \`${inv.field}\`.
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || process.cwd();
const FIELD = ${JSON.stringify(inv.field)};
const QUERY = /\\b(find|findOne|findMany|updateOne|updateMany|deleteOne|deleteMany|aggregate|count|count\\w*)\\s*\\(/;
function walk(d, acc){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(e.name==='node_modules'||e.name.startsWith('.'))continue; const p=path.join(d,e.name); if(e.isDirectory())walk(p,acc); else if(/\\.(ts|tsx|js|jsx)$/.test(e.name)&&!/\\.(test|spec)\\./.test(e.name))acc.push(p);} return acc; }
const viol=[];
for(const file of walk(ROOT,[])){ let c=''; try{c=fs.readFileSync(file,'utf8');}catch{continue;} const lines=c.split('\\n');
  for(let i=0;i<lines.length;i++){ if(QUERY.test(lines[i])){ const win=lines.slice(Math.max(0,i-1),i+4).join(' '); if(!win.includes(FIELD)) viol.push(path.relative(ROOT,file)+':'+(i+1)); } } }
console.log('invariant ${inv.id}: '+viol.length+' DB query site(s) without '+FIELD);
for(const v of viol.slice(0,40)) console.log('  '+v);
process.exit(process.env.EXIT_ON_VIOLATION==='1' && viol.length ? 1 : 0);
`;
}

// Semgrep rule (best-effort) for teams that run Semgrep.
function semgrepRule(inv) {
  return `rules:
  - id: ${inv.id}-missing-${inv.field}
    languages: [typescript, javascript]
    severity: WARNING
    message: "DB query may not be scoped by ${inv.field} (multi-tenant invariant)."
    patterns:
      - pattern-either:
          - pattern: $X.find(...)
          - pattern: $X.findOne(...)
          - pattern: $X.updateMany(...)
          - pattern: $X.deleteMany(...)
      - pattern-not: $X.$M(..., {..., ${inv.field}: ..., ...}, ...)
`;
}

function invariantsDoc(invariants) {
  const lines = ['# Repo invariants (auto-derived from the deep-map)', ''];
  if (!invariants.length) { lines.push('_No invariants derived — no tenant field or scoping convention detected._'); return lines.join('\n') + '\n'; }
  for (const inv of invariants) lines.push(`## ${inv.id}`, '', inv.description, '', `Enforced by \`.ecosystem/checks/${inv.id}.cjs\` (run in preflight/CI) + \`.ecosystem/semgrep/${inv.id}.yml\`.`, '');
  return lines.join('\n') + '\n';
}

module.exports = { detectTenantField, deriveInvariants, checkScript, semgrepRule, invariantsDoc };
