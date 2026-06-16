// src/deep-organize.js
// Organize a flat deep-map into a monorepo-aware doc tree: workspace/project -> feature-area.
// Writes ECOSYSTEM.md (top index) + by-project/<project>/{index.md, areas/<area>.md}.
// Stack-agnostic: area = first path segment after a generic source-root prefix is stripped.
const fs = require('node:fs');
const path = require('node:path');
const { workspaceOf } = require('./deep-select');

// Generic source-root prefixes stripped before deriving the area. Repos can extend via opts.wrappers.
const DEFAULT_WRAPPERS = ['src/app/api/', 'src/pages/api/', 'pages/api/', 'app/api/', 'src/', 'app/', 'pages/', 'lib/', 'components/', 'services/', 'routes/', 'controllers/', 'modules/', 'internal/', 'cmd/', 'pkg/'];

function areaOf(file, project, wrappers = DEFAULT_WRAPPERS) {
  let rel = project === '.' ? file : file.slice(project.length + 1);
  const sorted = wrappers.slice().sort((a, b) => b.length - a.length);
  for (const w of sorted) if (rel.startsWith(w)) { rel = rel.slice(w.length); break; }
  const segs = rel.split('/');
  return segs.length > 1 ? segs[0] : 'root';
}

const { isPublic } = require('./diagnostics/rbac');
const plist = (v) => Array.isArray(v) ? v.map((x) => typeof x === 'string' ? x : JSON.stringify(x)) : (v && typeof v === 'object' ? Object.keys(v) : []);
const slug = (s) => s.replace(/[^a-z0-9._-]/gi, '-');
const routesOf = (inv) => (inv.exposesEndpoints || []).filter((e) => e.type === 'route');
const callsOf = (inv) => (inv.connectionsOut || []).filter((c) => c.type === 'http-call');

function groupTree(deepMap, wrappers) {
  const tree = {};
  for (const f of deepMap.files) {
    const proj = workspaceOf(f.file), area = areaOf(f.file, proj, wrappers);
    (tree[proj] = tree[proj] || {});
    (tree[proj][area] = tree[proj][area] || []).push(f);
  }
  return tree;
}

function organize(deepMap, ecoDir, opts = {}) {
  const wrappers = opts.wrappers || DEFAULT_WRAPPERS;
  const tree = groupTree(deepMap, wrappers);
  const OUT = path.join(ecoDir, 'by-project');
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const projSummary = [];
  for (const proj of Object.keys(tree).sort()) {
    const areas = tree[proj];
    const projDir = path.join(OUT, slug(proj));
    fs.mkdirSync(path.join(projDir, 'areas'), { recursive: true });
    let pFiles = 0, pRoutes = 0, pCalls = 0, pFindings = 0, pNoAuth = 0;
    const areaRows = [];
    for (const area of Object.keys(areas).sort()) {
      const invs = areas[area];
      let aRoutes = 0, aCalls = 0, aFind = 0, aNoAuth = 0;
      const routeLines = ['## Endpoints (route · guards · params)', ''];
      for (const inv of invs) for (const e of routesOf(inv)) {
        aRoutes++; const pub = isPublic(e.guards); if (pub) aNoAuth++;
        const pr = [...plist(e.params?.path).map((x) => ':' + x), ...plist(e.params?.query).map((x) => '?' + x), ...plist(e.params?.body).map((x) => 'body.' + x)].join(' ');
        const label = /^(GET|POST|PUT|DELETE|PATCH|ANY)\b/i.test(String(e.id)) ? e.id : `${e.method || 'ANY'} ${e.id}`;
        routeLines.push(`- \`${label}\`${pub ? ' 🔓' : ''} — guards: [${(e.guards || []).join(', ') || 'none'}]${pr ? ` — ${pr}` : ''}  \`${inv.file}:${e.line}\``);
      }
      const callLines = ['', '## Outbound API calls (method · target · params)', ''];
      for (const inv of invs) for (const c of callsOf(inv)) {
        aCalls++;
        const pr = [...plist(c.params?.query).map((x) => '?' + x), ...plist(c.params?.body).map((x) => 'body.' + x)].join(' ');
        callLines.push(`- \`${c.method || 'GET'} ${c.target}\`${pr ? ` — ${pr}` : ''}  \`${inv.file}:${c.line}\``);
      }
      const findLines = ['', '## Findings', ''];
      for (const inv of invs) for (const x of inv.findings || []) { aFind++; findLines.push(`- [${x.kind}/${x.confidence}] ${String(x.note).replace(/\n/g, ' ').slice(0, 200)} \`${inv.file}:${x.line}\``); }
      const fileLines = ['', '## Files', '', ...invs.map((i) => `- \`${i.file}\` — ${i.purpose ? String(i.purpose).slice(0, 120) : ''}`)];
      fs.writeFileSync(path.join(projDir, 'areas', slug(area) + '.md'),
        [`# ${proj} / ${area}`, '', `_${invs.length} files · ${aRoutes} routes · ${aCalls} calls · ${aFind} findings_`, '', ...routeLines, ...callLines, ...findLines, ...fileLines].join('\n') + '\n');
      areaRows.push(`| [${area}](areas/${slug(area)}.md) | ${invs.length} | ${aRoutes} | ${aCalls} | ${aNoAuth} | ${aFind} |`);
      pFiles += invs.length; pRoutes += aRoutes; pCalls += aCalls; pFindings += aFind; pNoAuth += aNoAuth;
    }
    fs.writeFileSync(path.join(projDir, 'index.md'),
      [`# ${proj}`, '', `_${pFiles} files · ${pRoutes} routes · ${pCalls} outbound calls · ${pNoAuth} public/no-auth · ${pFindings} findings · ${Object.keys(areas).length} areas_`, '',
        '| Area | Files | Routes | Calls | No-auth | Findings |', '| --- | --- | --- | --- | --- | --- |', ...areaRows.sort()].join('\n') + '\n');
    projSummary.push({ proj, pFiles, pRoutes, pCalls, pFindings, pNoAuth, areas: Object.keys(areas).length });
  }

  projSummary.sort((a, b) => b.pFiles - a.pFiles);
  fs.writeFileSync(path.join(ecoDir, 'ECOSYSTEM.md'),
    ['# Deep Ecosystem Map', '', `_${deepMap.files.length} files across ${projSummary.length} workspace(s) · machine-generated from shipped code._`, '',
      '| Project | Files | Routes | Calls | No-auth | Findings | Areas |', '| --- | --- | --- | --- | --- | --- | --- |',
      ...projSummary.map((s) => `| [${s.proj}](by-project/${slug(s.proj)}/index.md) | ${s.pFiles} | ${s.pRoutes} | ${s.pCalls} | ${s.pNoAuth} | ${s.pFindings} | ${s.areas} |`)].join('\n') + '\n');

  return { projects: projSummary };
}

module.exports = { areaOf, groupTree, organize };
