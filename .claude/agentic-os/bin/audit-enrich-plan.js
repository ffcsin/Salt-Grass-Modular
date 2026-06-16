#!/usr/bin/env node
'use strict';
// Emit the audit-enrichment plan: every area whose audit still has agent-needed sections, each with a
// tight brief (routes/guards/key-files) the enriching agent uses. The enrich-audits skill consumes
// this JSON to fan out one agent per area (in waves). Sorted by impact (most routes first).
//   node bin/audit-enrich-plan.js <target> [--limit N]
const fs = require('node:fs'); const path = require('node:path');
const { group } = require('../src/group');
const { areasNeedingEnrich, briefForArea } = require('../src/audit-enrich');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const li = process.argv.indexOf('--limit'); const limit = li >= 0 ? parseInt(process.argv[li + 1], 10) : 0;

const map = JSON.parse(fs.readFileSync(path.join(root, '.ecosystem', 'map.json'), 'utf8'));
let deepMap = { files: [] }; try { deepMap = JSON.parse(fs.readFileSync(path.join(root, '.ecosystem', 'deep-map.json'), 'utf8')); } catch {}
const guardsByRoute = new Map();
for (const f of deepMap.files || []) for (const e of f.exposesEndpoints || []) { const rec = { guards: e.guards || [], params: e.params || {} }; guardsByRoute.set(`${e.method} ${e.route}`, rec); guardsByRoute.set(e.route, rec); }

const g = group(map);
const need = new Set(areasNeedingEnrich(root).map((x) => x.area));
let plan = g.order.filter((a) => need.has(a) && g.areas[a].routes.length + g.areas[a].feCalls.length > 0)
  .map((a) => ({ ...briefForArea(g.areas[a], guardsByRoute), auditPath: `.ecosystem/audits/${a}.md` }))
  .sort((x, y) => (y.routeCount + y.feCallCount) - (x.routeCount + x.feCallCount));
if (limit > 0) plan = plan.slice(0, limit);

console.log(JSON.stringify({ total: plan.length, plan }, null, 2));
