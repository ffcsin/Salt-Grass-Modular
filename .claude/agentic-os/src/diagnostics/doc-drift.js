// src/diagnostics/doc-drift.js
// Trust-but-verify, operationalized. The deep-map cites file:line for every endpoint, call, and
// finding. As the CODE changes after a map is built, those citations can go stale (file deleted,
// file shrank past the cited line). This gate samples citations and verifies them against the
// CURRENT code; disagreements are DRIFT — the map needs a refresh. Logged to DOC_DRIFT_LOG.md so the
// drift is visible (an established pattern; research flagged auto doc-drift detection as a differentiator).
const fs = require('node:fs');
const path = require('node:path');

// Pull every file:line citation out of the deep-map.
function collectCitations(deepMap) {
  const cites = [];
  for (const f of deepMap.files || []) {
    for (const e of f.exposesEndpoints || []) cites.push({ file: f.file, line: e.line || 0, kind: 'endpoint', what: e.id });
    for (const c of f.connectionsOut || []) if (c.type === 'http-call') cites.push({ file: f.file, line: c.line || 0, kind: 'call', what: c.target });
    for (const x of f.findings || []) cites.push({ file: f.file, line: x.line || 0, kind: 'finding', what: String(x.note || '').slice(0, 60) });
  }
  return cites;
}

// Verify citations against current code. Drift = file missing, or line beyond EOF.
function checkCitations(root, citations) {
  const lenCache = {};
  const fileLen = (rel) => {
    if (rel in lenCache) return lenCache[rel];
    let n = -1; // -1 = missing
    try { n = fs.readFileSync(path.join(root, rel), 'utf8').split('\n').length; } catch {}
    return (lenCache[rel] = n);
  };
  const drifted = [];
  for (const c of citations) {
    const len = fileLen(c.file);
    if (len === -1) drifted.push({ ...c, reason: 'file missing' });
    else if (c.line > len) drifted.push({ ...c, reason: `line ${c.line} > EOF (${len})` });
  }
  return { checked: citations.length, drifted, driftRate: citations.length ? drifted.length / citations.length : 0 };
}

// Deterministic sample (every Nth) so large maps don't re-check 10k citations every run.
function sample(citations, max) {
  if (!max || citations.length <= max) return citations;
  const step = Math.ceil(citations.length / max);
  return citations.filter((_, i) => i % step === 0);
}

function driftLogMarkdown(result, existing) {
  const stamp = '(latest run)';
  const lines = existing && existing.includes('# Doc drift log') ? existing.trimEnd().split('\n') : ['# Doc drift log', '', 'Citations in the deep-map that no longer match current code. Refresh the map (re-run bootstrap/preflight) to clear.', ''];
  lines.push('', `## ${stamp} — checked ${result.checked}, drifted ${result.drifted.length} (${(result.driftRate * 100).toFixed(1)}%)`, '');
  for (const d of result.drifted.slice(0, 100)) lines.push(`- [${d.kind}] \`${d.file}:${d.line}\` — ${d.reason} — ${d.what}`);
  return lines.join('\n') + '\n';
}

// Prose-doc guard: backtick'd file paths in generated/area docs that no longer exist on disk, and
// `path:line` references past EOF. Catches "doc says src/auth/jwt.ts but it moved" drift that the
// citation check (deep-map only) misses for hand-written/area prose.
function checkPathRefs(root, docText) {
  const drifted = [];
  const seen = new Set();
  const re = /`([\w./-]+\.[a-z]{1,4})(?::(\d+))?`/g;
  let m;
  while ((m = re.exec(String(docText || ''))) !== null) {
    const rel = m[1]; if (seen.has(m[0])) continue; seen.add(m[0]);
    if (!/[./]/.test(rel) || /^https?:/.test(rel)) continue;
    let content = null; try { content = fs.readFileSync(path.join(root, rel), 'utf8'); } catch {}
    if (content === null) { if (/\//.test(rel)) drifted.push({ ref: m[0], path: rel, reason: 'file missing' }); }
    else if (m[2] && +m[2] > content.split('\n').length) drifted.push({ ref: m[0], path: rel, reason: `line ${m[2]} > EOF` });
  }
  return drifted;
}

module.exports = { collectCitations, checkCitations, sample, driftLogMarkdown, checkPathRefs };
