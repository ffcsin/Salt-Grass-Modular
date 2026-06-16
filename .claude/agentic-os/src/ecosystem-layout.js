// src/ecosystem-layout.js
// Generate the EXACT Grok-spec ecosystem folder taxonomy from the deep-map, each folder fronted by an
// index.md in the strict 5-section AI-parse template (Overview / Key Files / Critical Rules / Cross
// References / Last Updated). renderLayout is PURE (takes a date) -> { relpath: content }; the bin writes it.
const { findParamMismatches } = require('./diagnostics/param-mismatch');
const { isPublic, guardSet } = require('./diagnostics/rbac');

const pathOf = (id) => String(id || '').replace(/^\s*(GET|POST|PUT|DELETE|PATCH|ANY)\s+/i, '');
const plist = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v) : []);

// The strict per-folder index template (built for AI parsing).
function indexMd({ title, overview, keyFiles = [], criticalRules = [], crossRefs = [], date }) {
  return [
    `# ${title} — index`, '',
    '## Overview', overview, '',
    '## Key Files', ...(keyFiles.length ? keyFiles.map((f) => `- ${f}`) : ['- _(none)_']), '',
    '## Critical Rules', ...(criticalRules.length ? criticalRules.map((r) => `- ${r}`) : ['- _none recorded_']), '',
    '## Cross References', ...(crossRefs.length ? crossRefs.map((r) => `- ${r}`) : ['- _none_']), '',
    `## Last Updated`, `${date} · agentic-os (machine-generated; regenerated each run)`, '',
  ].join('\n') + '\n';
}

function renderLayout(deepMap, opts = {}) {
  const date = opts.date || '0000-00-00';
  const dead = opts.deadFrontend || []; // list of dead FE file paths
  const out = {};

  // collect surfaces
  const routes = [], feCalls = [], secFindings = [], tenancyFindings = [], improvements = [];
  for (const f of deepMap.files || []) {
    for (const e of f.exposesEndpoints || []) if (e.type === 'route') routes.push({ ...e, file: f.file });
    for (const c of f.connectionsOut || []) if (c.type === 'http-call') feCalls.push({ ...c, file: f.file });
    for (const x of f.findings || []) {
      if (x.kind === 'security') secFindings.push({ ...x, file: f.file });
      else if (x.kind === 'tenancy') tenancyFindings.push({ ...x, file: f.file });
      else if (x.kind === 'perf' || x.kind === 'inconsistency' || x.kind === 'gotcha') improvements.push({ ...x, file: f.file });
    }
  }
  const orphanRoutes = (deepMap.orphans && deepMap.orphans.routesNoCaller) || [];
  const mismatches = findParamMismatches(deepMap);
  const guarded = routes.filter((r) => !isPublic(r.guards));
  const publicR = routes.filter((r) => isPublic(r.guards));

  // ---- routes/ ----
  out['routes/backend-routes.md'] = ['# Backend routes', '', ...routes.map((r) => {
    const pr = [...plist(r.params?.path).map((x) => ':' + x), ...plist(r.params?.query).map((x) => '?' + x), ...plist(r.params?.body).map((x) => 'body.' + x)].join(' ');
    return `- \`${/^(GET|POST|PUT|DELETE|PATCH|ANY)\b/i.test(String(r.id)) ? r.id : (r.method || 'ANY') + ' ' + r.id}\`${isPublic(r.guards) ? ' 🔓' : ''} — guards:[${guardSet(r.guards).join(', ') || 'none'}]${pr ? ' — ' + pr : ''}  \`${r.file}:${r.line}\``;
  })].join('\n') + '\n';
  out['routes/frontend-calls.md'] = ['# Frontend → backend calls', '', ...feCalls.map((c) => {
    const pr = [...plist(c.params?.query).map((x) => '?' + x), ...plist(c.params?.body).map((x) => 'body.' + x)].join(' ');
    return `- \`${c.method || 'GET'} ${c.target}\`${pr ? ' — ' + pr : ''}  \`${c.file}:${c.line}\``;
  })].join('\n') + '\n';
  out['routes/mismatches.md'] = ['# FE↔BE param mismatches', '', `_${mismatches.length} candidates (advisory)._`, '', ...mismatches.map((m) => `- \`${m.method} ${m.route.replace(/^(GET|POST|PUT|DELETE|PATCH|ANY) /, '')}\` — call ${m.call.file}:${m.call.line}` + (m.missingInCall.length ? ` · MISSING ${m.missingInCall.join(', ')}` : '') + (m.extraInCall.length ? ` · EXTRA ${m.extraInCall.join(', ')}` : ''))].join('\n') + '\n';
  out['routes/index.md'] = indexMd({ title: 'routes', date,
    overview: `Every backend route (${routes.length}) and every frontend→backend call (${feCalls.length}), plus param mismatches (${mismatches.length}).`,
    keyFiles: ['backend-routes.md — all endpoints + guards + params', 'frontend-calls.md — all FE calls', 'mismatches.md — FE call vs route param mismatches'],
    criticalRules: ['A FE call must hit a real route with matching params.', 'Check mismatches.md before wiring a new FE call.'],
    crossRefs: ['../auth/rbac.md (guards per route)', '../orphans/unused-backend.md (routes with no caller)'] });

  // ---- auth/ ----
  out['auth/backend-auth.md'] = ['# Backend auth (routes by guard)', '',
    '> ⚠️ **Trust-but-verify:** "no-auth" means NO PER-ROUTE guard decorator was found. A route here MAY still be protected by a GLOBAL guard (`APP_GUARD`), auth middleware (`app.use(...)`), or a gateway — the extractor only sees per-route decorators. Before treating any of these as a vulnerability, open the file and check for global/middleware auth.', '',
    `## Guarded (${guarded.length})`, '', ...guarded.map((r) => `- \`${r.method || 'ANY'} ${pathOf(r.id)}\` — [${guardSet(r.guards).join(', ')}]  \`${r.file}:${r.line}\``), '', `## Public / no-auth 🔓 (${publicR.length})`, '', ...publicR.map((r) => `- \`${r.method || 'ANY'} ${pathOf(r.id)}\`  \`${r.file}:${r.line}\``)].join('\n') + '\n';
  out['auth/rbac.md'] = ['# RBAC matrix (endpoint → required guards/roles)', '', ...routes.map((r) => `- \`${r.method || 'ANY'} ${pathOf(r.id)}\` → ${guardSet(r.guards).join(', ') || '🔓 none (public)'}`)].join('\n') + '\n';
  const feAuth = feCalls.filter((c) => /auth|login|token|session|oauth|magic|signin|sign-in|logout/i.test(c.target + ' ' + (c.detail || '')));
  out['auth/frontend-auth.md'] = ['# Frontend auth surface', '', `_FE calls touching auth/login/token/session (${feAuth.length})._`, '', ...feAuth.map((c) => `- \`${c.method || 'GET'} ${c.target}\`  \`${c.file}:${c.line}\``)].join('\n') + '\n';
  out['auth/index.md'] = indexMd({ title: 'auth', date,
    overview: `Authentication + RBAC. ${guarded.length} guarded routes, ${publicR.length} public/no-auth, ${feAuth.length} FE auth calls.`,
    keyFiles: ['backend-auth.md — routes split guarded vs public', 'rbac.md — the guard/role matrix', 'frontend-auth.md — FE auth calls'],
    criticalRules: ['Never remove a route guard without a deliberate decision (logs as a security regression).', `Public (🔓) mutating endpoints are a review priority — see ../security/findings.md.`],
    crossRefs: ['../security/findings.md', '../routes/backend-routes.md'] });

  // ---- security/ ----
  out['security/findings.md'] = ['# Security findings', '', `_${secFindings.length} security findings (from the deep map)._`, '', ...secFindings.sort((a, b) => (a.confidence === 'high' ? -1 : 1) - (b.confidence === 'high' ? -1 : 1)).map((x) => `- [${x.confidence}] ${x.file}:${x.line} — ${String(x.note).replace(/\n/g, ' ').slice(0, 220)}`)].join('\n') + '\n';
  out['security/index.md'] = indexMd({ title: 'security', date,
    overview: `${secFindings.length} security findings + ${tenancyFindings.length} tenancy findings. The repo's risk surface.`,
    keyFiles: ['findings.md — security findings ranked by confidence'],
    criticalRules: ['Every protected route needs a guard; every multi-tenant query must scope the tenant field.', 'New no-auth endpoints / removed guards fail the security-regression gate.'],
    crossRefs: ['../auth/rbac.md', '../warnings/critical.md'] });

  // ---- warnings/ ----
  out['warnings/critical.md'] = ['# Critical warnings', '', `_High-confidence security + tenancy issues._`, '', ...[...secFindings, ...tenancyFindings].filter((x) => x.confidence === 'high').map((x) => `- [${x.kind}] ${x.file}:${x.line} — ${String(x.note).slice(0, 200)}`)].join('\n') + '\n';
  out['warnings/improvements.md'] = ['# Improvements', '', `_perf / inconsistency / gotcha findings (${improvements.length})._`, '', ...improvements.slice(0, 800).map((x) => `- [${x.kind}] ${x.file}:${x.line} — ${String(x.note).slice(0, 160)}`)].join('\n') + '\n';
  out['warnings/index.md'] = indexMd({ title: 'warnings', date,
    overview: `Known issues. Critical = high-confidence security/tenancy; Improvements = perf/consistency/gotchas (${improvements.length}).`,
    keyFiles: ['critical.md — fix-now class', 'improvements.md — nice-to-fix'],
    criticalRules: ['Triage critical.md before shipping.'], crossRefs: ['../security/findings.md'] });

  // ---- orphans/ ----
  out['orphans/unused-backend.md'] = ['# Unused backend (orphan routes — no FE caller)', '', `_${orphanRoutes.length}. May be dead, externally/dynamically called, or intentionally parked (see ../warnings/ for parked sign-off)._`, '', ...orphanRoutes.slice(0, 600).map((r) => `- \`${r.method || 'ANY'} ${r.route}\` — ${r.file}:${r.line}`)].join('\n') + '\n';
  out['orphans/unused-frontend.md'] = ['# Unused frontend (dead components)', '', `_${dead.length}. Never imported + export never used as a JSX tag. Verify before deleting._`, '', ...dead.slice(0, 600).map((d) => `- \`${d}\``)].join('\n') + '\n';
  out['orphans/index.md'] = indexMd({ title: 'orphans', date,
    overview: `Abandoned code: ${orphanRoutes.length} orphan backend routes, ${dead.length} dead frontend components.`,
    keyFiles: ['unused-backend.md', 'unused-frontend.md'],
    criticalRules: ['Confirm intent before deleting — move deliberate kept-code to warnings/parked.'], crossRefs: ['../routes/backend-routes.md'] });

  // ---- decisions/ + intentions/ pointers ----
  out['decisions/index.md'] = indexMd({ title: 'decisions', date, overview: 'Architecture Decision Records — the "why" behind choices.', keyFiles: ['../adr/ — numbered ADRs (use the adr-capture skill to add one)'], criticalRules: ['ADRs are immutable; supersede, never rewrite.'], crossRefs: ['../adr/README.md'] });
  out['intentions/index.md'] = indexMd({ title: 'intentions', date, overview: 'What each area is SUPPOSED to do (intent), so the code can be judged against purpose, not just read.', keyFiles: ['../intent/<area>.md — human-owned intent (enrich-docs seeds, intent-interview confirms)'], criticalRules: ['When code conflicts with intent, surface it — do not silently follow the code.'], crossRefs: ['../ECOSYSTEM.md'] });

  // ---- top-level index ----
  out['index.md'] = indexMd({ title: 'ecosystem', date,
    overview: `Machine-generated map of this repo: ${routes.length} routes, ${feCalls.length} FE calls, ${secFindings.length} security + ${tenancyFindings.length} tenancy findings, ${orphanRoutes.length} orphan routes, ${dead.length} dead FE components.`,
    keyFiles: ['routes/ — every endpoint + FE call + mismatches', 'auth/ — guards + RBAC matrix', 'security/ — risk surface', 'warnings/ — critical + improvements', 'orphans/ — dead code', 'decisions/ → adr/', 'intentions/ → intent/'],
    criticalRules: ['Trust-but-verify: this is generated from shipped code; confirm a cited file:line before acting.', 'Read the matching folder index BEFORE editing that area.'],
    crossRefs: ['ECOSYSTEM.md (by-project view)', 'verify-report.md (accuracy verdict)'] });

  return out;
}

module.exports = { indexMd, renderLayout };
