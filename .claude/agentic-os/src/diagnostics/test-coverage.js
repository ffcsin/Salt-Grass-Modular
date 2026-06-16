// src/diagnostics/test-coverage.js
// Test-to-surface coverage map (research §9 — the test-to-symbol linkage most tools skip). Finds
// every test file, harvests the route paths / symbols each references, then diffs against the
// deep-map's endpoints to surface UNTESTED endpoints. Feeds the testing-strategy skill. Heuristic
// (a route is "covered" if a distinctive part of its path appears in some test) — advisory.
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../../lib/walk');
const { normalizeRoute } = require('../../lib/url-normalize');

const isTestFile = (f) => /\.(test|spec)\.[tj]sx?$/.test(f) || /(^|\/)__tests__\//.test(f.replace(/\\/g, '/'));
const pathOf = (id) => String(id || '').replace(/^\s*(GET|POST|PUT|DELETE|PATCH|ANY)\s+/i, '');

// A distinctive needle for a route = its last non-param static segment (e.g. /scraper/run/:id -> run).
function routeNeedle(routePath) {
  const segs = normalizeRoute(routePath).split('/').filter((s) => s && s !== ':param');
  return segs[segs.length - 1] || '';
}

function buildCoverage(root, deepMap, opts = {}) {
  const exts = opts.exts || ['.ts', '.tsx', '.js', '.jsx'];
  let files = [];
  try { files = walk(root, { include: exts }); } catch {}
  // concatenate all test content (one scan)
  let testBlob = '';
  let testFileCount = 0;
  for (const abs of files) {
    if (!isTestFile(abs)) continue;
    testFileCount++;
    try { testBlob += '\n' + fs.readFileSync(abs, 'utf8'); } catch {}
  }
  // endpoints from the deep-map
  const endpoints = [];
  for (const f of deepMap.files || []) for (const e of f.exposesEndpoints || []) {
    if (e.type === 'route') endpoints.push({ id: `${e.method || 'ANY'} ${pathOf(e.id)}`, path: pathOf(e.id), file: f.file, line: e.line, guards: e.guards || [] });
  }
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const covered = [], untested = [];
  for (const e of endpoints) {
    const needle = routeNeedle(e.path);
    // covered if its full path OR its distinctive needle appears in tests
    const hit = needle && (testBlob.includes(e.path) || new RegExp(`['"\`/]${escapeRe(needle)}['"\`/ ]`).test(testBlob));
    (hit ? covered : untested).push(e);
  }
  return {
    testFiles: testFileCount, endpoints: endpoints.length,
    covered: covered.length, untested,
    coverageRate: endpoints.length ? covered.length / endpoints.length : 1,
  };
}

module.exports = { isTestFile, routeNeedle, buildCoverage };
