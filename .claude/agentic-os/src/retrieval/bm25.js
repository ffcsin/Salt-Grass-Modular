'use strict';
// BM25 lexical retrieval over code chunks — the embedding-free RAG. Exact identifier/keyword matches
// dominate code search, so BM25 (sparse) recovers most of the benefit of dense retrieval without an
// embedding model or vector store (stays zero-dep). Chunks = files (or sliding windows); ranked by
// BM25; optionally reranked by symbol-graph proximity. The relevance-retrieval half the graph lacks.
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../../lib/walk');
const { SRC } = require('../symbols');

const STOP = new Set(['the', 'and', 'for', 'this', 'that', 'with', 'from', 'const', 'let', 'var', 'function', 'return', 'import', 'export', 'if', 'else', 'new']);

// camelCase/snake/kebab-aware tokenizer — splits identifiers so `getUserById` matches `user`.
function tokenize(text) {
  const raw = String(text || '').toLowerCase().match(/[a-z0-9_$]+/g) || [];
  const out = [];
  for (const t of raw) {
    out.push(t);
    // split subwords on case/underscore boundaries from the ORIGINAL casing approximation
    for (const sub of t.split(/[_$]+/)) if (sub && sub !== t) out.push(sub);
  }
  // also split camelCase from the original text
  for (const m of (String(text).match(/[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g) || [])) { const s = m.toLowerCase(); if (s.length > 1) out.push(s); }
  return out.filter((t) => t.length > 1 && !STOP.has(t));
}

function buildIndex(root, opts = {}) {
  const exts = opts.exts || SRC;
  let files = []; try { files = walk(root, { include: exts }); } catch {}
  files = files.filter((f) => !/\.d\.ts$/.test(f));
  const docs = [];
  const df = new Map(); // document frequency
  let totalLen = 0;
  for (const abs of files) {
    let content = ''; try { content = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (content.length > (opts.maxChars || 200000)) content = content.slice(0, opts.maxChars || 200000);
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    const toks = tokenize(content);
    const tf = new Map(); for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    docs.push({ file: rel, len: toks.length, tf });
    totalLen += toks.length;
  }
  return { docs, df, N: docs.length, avgdl: docs.length ? totalLen / docs.length : 0 };
}

// BM25 score of query against the index. k1/b standard defaults.
function search(index, query, { k1 = 1.5, b = 0.75, limit = 10 } = {}) {
  const qToks = [...new Set(tokenize(query))];
  const { docs, df, N, avgdl } = index;
  const idf = (t) => Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
  const scored = docs.map((d) => {
    let s = 0;
    for (const t of qToks) {
      const f = d.tf.get(t); if (!f) continue;
      s += idf(t) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (d.len / (avgdl || 1))));
    }
    return { file: d.file, score: s };
  }).filter((x) => x.score > 0).sort((a, b2) => b2.score - a.score);
  return scored.slice(0, limit);
}

module.exports = { tokenize, buildIndex, search };
