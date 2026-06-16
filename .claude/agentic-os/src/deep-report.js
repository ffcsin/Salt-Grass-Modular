// src/deep-report.js
// Cross-cutting lists (no-auth endpoints, missing-param calls, findings by kind) + the VERIFY
// REPORT that states, every run, whether the map is trustworthy: coverage, completeness, accuracy.
const fs = require('node:fs');
const path = require('node:path');

const { isPublic } = require('./diagnostics/rbac');
const plist = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v) : []);

function buildLists(deepMap) {
  const noAuth = [], missingParams = [], byKind = {};
  for (const f of deepMap.files) {
    for (const e of f.exposesEndpoints || []) {
      if (e.type !== 'route') continue;
      if (isPublic(e.guards)) noAuth.push({ file: f.file, line: e.line, id: e.id, method: e.method, guards: e.guards || [] });
      if (/[:\[]/.test(String(e.id)) && plist(e.params?.path).length === 0) missingParams.push({ kind: 'route-no-pathparam', file: f.file, line: e.line, id: e.id });
    }
    for (const c of f.connectionsOut || []) {
      if (c.type !== 'http-call') continue;
      if (['POST', 'PUT', 'PATCH'].includes(String(c.method || '').toUpperCase()) && plist(c.params?.body).length === 0 && plist(c.params?.query).length === 0)
        missingParams.push({ kind: 'write-call-no-params', file: f.file, line: c.line, id: `${c.method} ${c.target}` });
    }
    for (const x of f.findings || []) (byKind[x.kind] = byKind[x.kind] || []).push({ file: f.file, line: x.line, conf: x.confidence, note: x.note });
  }
  return { noAuth, missingParams, byKind };
}

function writeReports(deepMap, gates, ecoDir) {
  const REP = path.join(ecoDir, 'reports');
  fs.mkdirSync(REP, { recursive: true });
  const { noAuth, missingParams, byKind } = buildLists(deepMap);
  const list = (name, title, rows, fmt) => fs.writeFileSync(path.join(REP, name),
    [`# ${title} (${rows.length})`, '', ...rows.map(fmt)].join('\n') + '\n');

  list('no-auth-endpoints.md', 'No-auth / no-RBAC HTTP endpoints', noAuth,
    (r) => `- \`${/^(GET|POST|PUT|DELETE|PATCH|ANY)\b/i.test(String(r.id)) ? r.id : `${r.method || 'ANY'} ${r.id}`}\` — ${r.file}:${r.line} (guards: ${(r.guards || []).join(', ') || 'none'})`);
  list('missing-params.md', 'Endpoints/calls with missing params', missingParams, (r) => `- [${r.kind}] \`${r.id}\` — ${r.file}:${r.line}`);
  for (const k of Object.keys(byKind)) list(`findings-${k}.md`, `${k} findings`, byKind[k], (r) => `- [${r.conf}] ${r.file}:${r.line} — ${String(r.note).replace(/\n/g, ' ').slice(0, 220)}`);

  // VERIFY REPORT
  const { missing = [], undercounts = [], accuracy = null, expectedCount = deepMap.files.length } = gates || {};
  const coverageOk = missing.length === 0;
  const completeOk = undercounts.length === 0;
  let httpCalls = 0, routes = 0, findings = 0;
  for (const f of deepMap.files) { httpCalls += (f.connectionsOut || []).filter((c) => c.type === 'http-call').length; routes += (f.exposesEndpoints || []).filter((e) => e.type === 'route').length; findings += (f.findings || []).length; }
  const accLine = accuracy && accuracy.sampled
    ? `${accuracy.confirmed}/${accuracy.sampled} sampled findings confirmed (${Math.round((accuracy.confirmed / accuracy.sampled) * 100)}%)`
    : 'not sampled (run verify-deep for an accuracy %)';
  const verdict = coverageOk && completeOk ? '✅ TRUSTED' : '🚨 NEEDS-REVIEW';
  const md = [
    `# Deep-map verification report`, '',
    `**Verdict: ${verdict}**`, '',
    `| Gate | Result |`, `| --- | --- |`,
    `| Coverage | ${deepMap.files.length}/${expectedCount} files ${coverageOk ? '✅' : `🚨 ${missing.length} MISSING`} |`,
    `| Completeness (API calls) | ${completeOk ? '✅ 0 undercounts' : `🚨 ${undercounts.length} files undercount`} |`,
    `| Accuracy (findings) | ${accLine} |`, '',
    `## Totals`, `- files: ${deepMap.files.length}`, `- routes: ${routes}`, `- http-calls: ${httpCalls}`,
    `- no-auth endpoints: ${noAuth.length}`, `- findings: ${findings}`, '',
    ...(missing.length ? ['## Missing files (re-run gap-fill)', '', ...missing.slice(0, 50).map((f) => `- ${f}`), ''] : []),
    ...(undercounts.length ? ['## Undercounting files (re-extract)', '', ...undercounts.slice(0, 50).map((u) => `- ${u.f || u} (emitted ${u.emitted}/${u.network})`), ''] : []),
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(ecoDir, 'verify-report.md'), md);

  return { coverageOk, completeOk, verdict, noAuth: noAuth.length, httpCalls, routes, findings };
}

module.exports = { buildLists, writeReports };
