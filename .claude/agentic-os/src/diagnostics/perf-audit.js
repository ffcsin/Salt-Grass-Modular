// src/diagnostics/perf-audit.js
// Performance & scalability anti-pattern scanner (the Performance Auditor's deterministic eyes).
// High-signal patterns that AI-generated code commonly introduces. Heuristic + advisory — each is a
// candidate to verify, not a guaranteed bug.
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../../lib/walk');

const QUERY = /\b(find|findOne|findMany|aggregate|query|select|get|update|delete|count)\s*\(/;
const LOOP = /\b(for|while|forEach|\.map\(|\.forEach\()/;

// Scan one file's lines for perf anti-patterns.
function scanPerf(content) {
  const hits = [];
  const lines = String(content || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // await inside a loop body (serial round-trips that should be Promise.all)
    if (/\bawait\b/.test(l) && LOOP.test(lines.slice(Math.max(0, i - 3), i).join(' '))) {
      hits.push({ line: i + 1, kind: 'await-in-loop', note: 'awaiting inside a loop = serial round-trips; consider Promise.all / batch' });
    }
    // DB query inside a loop body (N+1)
    if (QUERY.test(l) && /await/.test(l) && LOOP.test(lines.slice(Math.max(0, i - 3), i).join(' '))) {
      hits.push({ line: i + 1, kind: 'n-plus-1', note: 'DB query inside a loop = N+1; batch or join' });
    }
    // unbounded find (no limit / pagination nearby)
    if (/\.find\(\s*\{?/.test(l) && !/limit|take|first|paginat/i.test(lines.slice(i, i + 3).join(' '))) {
      hits.push({ line: i + 1, kind: 'unbounded-query', note: 'find() without limit/pagination — can scan/return everything at scale' });
    }
    // JSON.parse(JSON.stringify(...)) deep clone
    if (/JSON\.parse\(\s*JSON\.stringify/.test(l)) hits.push({ line: i + 1, kind: 'deep-clone-json', note: 'JSON deep-clone is slow on hot paths' });
    // SELECT * style / no field projection on big reads — heuristic skip (too noisy)
  }
  // dedupe by line+kind
  const seen = new Set();
  return hits.filter((h) => { const k = `${h.line}:${h.kind}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function auditPerf(root, opts = {}) {
  const exts = opts.exts || ['.ts', '.js'];
  let files = [];
  try { files = walk(root, { include: exts }); } catch {}
  const out = [];
  const byKind = {};
  for (const abs of files) {
    if (/node_modules|\.(test|spec)\.|\.d\.ts/.test(abs)) continue;
    let c = ''; try { c = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    for (const h of scanPerf(c)) { out.push({ file: path.relative(root, abs).replace(/\\/g, '/'), ...h }); byKind[h.kind] = (byKind[h.kind] || 0) + 1; }
  }
  return { total: out.length, byKind, hits: out };
}

module.exports = { scanPerf, auditPerf };
