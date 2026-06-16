#!/usr/bin/env node
'use strict';
// Generate tool-audit-depth docs (.ecosystem/audits/<area>.md) — reference-parity 9-section audits, all
// deterministic content filled, semantic sections marked AGENT-NEEDED. Plus AUDIT_COMPLETENESS.md.
//   node bin/gen-audits.js <target>
const fs = require('node:fs'); const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { group } = require('../src/group');
const { renderAuditDoc, scoreAudit } = require('../src/audit-doc');
const { extractGates, extractFeSurfaces } = require('../src/catalogs');
const { preserveEnriched } = require('../src/audit-enrich');

const root = path.resolve(process.argv[2] || '.');
const eco = path.join(root, '.ecosystem');
const map = JSON.parse(fs.readFileSync(path.join(eco, 'map.json'), 'utf8'));
let deepMap = { files: [] }; try { deepMap = JSON.parse(fs.readFileSync(path.join(eco, 'deep-map.json'), 'utf8')); } catch {}

// guards/params by "METHOD route" + by route
const guardsByRoute = new Map();
for (const f of deepMap.files || []) for (const e of f.exposesEndpoints || []) {
  const rec = { guards: e.guards || [], params: e.params || {} };
  guardsByRoute.set(`${e.method} ${e.route}`, rec); guardsByRoute.set(e.route, rec);
}

const g = group(map);

// file -> area (from each area's route/call source files)
const fileArea = new Map();
for (const name of g.order) { const b = g.areas[name]; for (const r of b.routes) fileArea.set(r.file, name); for (const w of b.feCalls) if (w.from) fileArea.set(w.from.file, name); }
function areaForFile(f) { if (fileArea.has(f)) return fileArea.get(f); const seg = String(f).split('/').filter(Boolean); const i = seg.indexOf('src'); const a = i >= 0 ? seg[i + 1] : (seg.includes('protected') ? seg[seg.indexOf('protected') + 1] : null); return a || null; }

// gates + buttons grouped by area
const gatesByArea = {}, buttonsByArea = {};
for (const x of extractGates(root)) { const a = areaForFile(x.file); if (a) (gatesByArea[a] = gatesByArea[a] || []).push(x); }
for (const s of extractFeSurfaces(root)) { const a = areaForFile(s.file); if (a) for (const b of s.buttons) (buttonsByArea[a] = buttonsByArea[a] || []).push({ ...b, file: s.file }); }

// recently-fixed: ONE git-log pass for the whole repo, then bucket commits to areas by the files
// they touched (10x+ faster than a git invocation per area). Builds area -> [commits] up front.
function buildRecentlyFixedIndex() {
  const byArea = {};
  let out = '';
  try { out = execFileSync('git', ['log', '--name-only', '--pretty=format:@@@%h|%ad|%s', '--date=short', '-n', '4000'], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }); } catch { return byArea; }
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('@@@')) {
      const [sha, date, ...rest] = line.slice(3).split('|'); const subject = rest.join('|');
      cur = /^(fix|feat)/i.test(subject) && !/^chore\(ecosystem\)|\[skip ci\]/i.test(subject) ? { sha, date, subject, areas: new Set() } : null;
    } else if (cur && line.trim()) {
      const a = areaForFile(line.trim());
      if (a && !cur.areas.has(a)) { cur.areas.add(a); (byArea[a] = byArea[a] || []); if (byArea[a].length < 5 && !byArea[a].some((c) => c.sha === cur.sha)) byArea[a].push({ sha: cur.sha, date: cur.date, subject: cur.subject }); }
    }
  }
  return byArea;
}
const recentlyFixedIdx = buildRecentlyFixedIndex();
const recentlyFixed = (b) => recentlyFixedIdx[b.area] || [];

// related areas = areas this area's FE calls resolve into (different from self)
function related(b) { const s = new Set(); for (const w of b.feCalls) { if (!w.route) continue; const seg = w.route.split('/').filter(Boolean)[0]; if (seg && seg !== b.area && g.areas[seg]) s.add(seg); } return [...s]; }

const dir = path.join(eco, 'audits'); fs.mkdirSync(dir, { recursive: true });
const scores = [];
for (const name of g.order) {
  if (name === 'ungrouped' || name === 'root') continue;
  const b = g.areas[name];
  let md = renderAuditDoc(b, { guardsByRoute, gates: gatesByArea[name] || [], feButtons: buttonsByArea[name] || [], recentlyFixed: recentlyFixed(b), related: related(b) });
  // ADDITIVE: if an audit already exists with agent-enriched prose, carry it forward (regenerate the
  // deterministic sections, keep the agent's Intent/Behavior/Gap/TechDebt). Never clobber enrichment.
  const outPath = path.join(dir, name + '.md');
  try { if (fs.existsSync(outPath)) md = preserveEnriched(md, fs.readFileSync(outPath, 'utf8')); } catch {}
  fs.writeFileSync(outPath, md);
  const sc = scoreAudit(md); scores.push({ area: name, ...sc });
}
scores.sort((a, b) => b.total - a.total);
const avg = scores.length ? (scores.reduce((s, x) => s + x.total, 0) / scores.length) : 0;
fs.writeFileSync(path.join(eco, 'AUDIT_COMPLETENESS.md'),
  [`# Audit completeness`, '', `_${scores.length} audits · avg ${avg.toFixed(1)}/27 · deterministic sections filled; Intent + Tech Debt await the enrich/agent pass._`, '',
   '| area | score | Intent | BE | FE | Gaps | RecentlyFixed |', '|---|---|---|---|---|---|---|',
   ...scores.slice(0, 200).map((s) => `| ${s.area} | ${s.total}/27 | ${s.per.Intent} | ${s.per['BE Inventory']} | ${s.per['FE Inventory']} | ${s.per['Gap Analysis']} | ${s.per['Recently Fixed']} |`)].join('\n') + '\n');
console.log(JSON.stringify({ audits: scores.length, avgScore: +avg.toFixed(1) }));
