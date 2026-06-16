const { readFileSync, existsSync, readdirSync } = require('node:fs');
const path = require('node:path');
const ecoDir = (p) => path.join(p, '.ecosystem');
function hasEcosystem(projectDir) { return existsSync(path.join(ecoDir(projectDir), 'path-to-area.json')); }
function loadPathToArea(projectDir) {
  try { return JSON.parse(readFileSync(path.join(ecoDir(projectDir), 'path-to-area.json'), 'utf8')); } catch { return null; }
}

// Generic/catch-all area names — a SPECIFIC feature area (commissions, payments, auth) should win over
// these when a file path names it. Otherwise everything under backend/internal/api/routes collapses to
// 'admin' and the rich per-feature audits never load (a v1 connectivity gap).
const GENERIC = new Set(['-', 'root', 'ungrouped', 'admin', 'api', 'internal', 'core', 'system', 'status',
  'v1', 'app', 'src', 'lib', 'server', 'backend', 'frontend', 'common', 'shared', 'utils', 'util', 'health',
  'handlers', 'routes', 'services', 'service', 'pkg', 'cmd']);

// The real area vocabulary = the audit docs (richest; falls back to area maps). Cached per root (a Map,
// so a long-lived process walking multiple repos doesn't get stale results — review LOW).
const _areaCache = new Map();
function knownAreas(projectDir) {
  if (_areaCache.has(projectDir)) return _areaCache.get(projectDir);
  const out = new Set();
  for (const sub of ['audits', 'areas']) {
    try { for (const f of readdirSync(path.join(ecoDir(projectDir), sub))) if (f.endsWith('.md')) out.add(f.slice(0, -3)); } catch {}
    if (out.size) break;
  }
  _areaCache.set(projectDir, out); return out;
}

// Tokens from a file path (dir components + filename split on separators), lowercased, len>2.
function pathTokens(rel) {
  return rel.replace(/\.[a-z0-9]+$/i, '').split(/[\/_\-.]+/).filter((t) => t && t.length > 2).map((t) => t.toLowerCase());
}
// The most-specific feature area named anywhere in the path, matched against the audit vocabulary
// (singular/plural tolerant). Generic names are never returned here.
function tokenArea(rel, areas) {
  let best = null;
  for (const t of pathTokens(rel)) {
    // Plural/singular folding only for tokens ≥4 chars — else 'new'→'news', 'use'→'uses' false-match
    // an unrelated area (review LOW). The token itself is always tried.
    const cands = [t];
    if (t.length >= 4) cands.push(t.endsWith('s') ? t.slice(0, -1) : t + 's');
    for (const cand of cands) {
      if (areas.has(cand) && !GENERIC.has(cand) && (!best || cand.length > best.length)) best = cand;
    }
  }
  return best;
}

// Resolve a file to its area, preferring a SPECIFIC feature audit named in the path over the coarse
// route-vote glob (e.g. admin_commissions.go / commissions/service.go → 'commissions', not 'admin').
// Returns { area, doc } or null. Falls back to the glob when no feature token is present.
function areaForFile(filePath, pta, projectDir) {
  const rel = path.relative(projectDir || '.', filePath).replace(/\\/g, '/');
  let globArea = null, bestLen = -1;
  if (pta && pta.mappings) {
    for (const m of pta.mappings) {
      const pre = m.glob.replace(/\*\*$/, '');
      if ((rel === pre || rel.startsWith(pre) || pre === '') && pre.length > bestLen) { globArea = m.area; bestLen = pre.length; }
    }
  }
  const areas = projectDir ? knownAreas(projectDir) : new Set();
  const dirPart = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) + '/' : '';
  const dirTok = tokenArea(dirPart, areas);   // a feature area named by a DIRECTORY — strongest signal
  const fullTok = tokenArea(rel, areas);      // a feature area named anywhere (dir or filename)
  // Precedence: a directory-named feature area (e.g. .../accounting/x.go) beats even a non-generic but
  // wrong route-vote glob (accounting→debug); then a non-generic glob; then a filename-named feature
  // area (admin_commissions.go → commissions, beating the generic 'admin' glob); then the glob.
  const area = dirTok || (globArea && !GENERIC.has(globArea) ? globArea : null) || fullTok || globArea || null;
  if (!area) return null;
  return { area, doc: `.ecosystem/audits/${area}.md` };
}
function loadAreaDoc(projectDir, area, cap) {
  try { const t = readFileSync(path.join(ecoDir(projectDir), 'areas', area + '.md'), 'utf8'); return cap ? t.slice(0, cap) : t; } catch { return null; }
}
module.exports = { hasEcosystem, loadPathToArea, areaForFile, loadAreaDoc, knownAreas, tokenArea, ecoDir };
