'use strict';
// PageRank-ranked, token-budgeted repo map (the most-validated open-source context primitive, à la
// Aider). Builds a symbol reference graph (file defines symbol; file B references symbol → edge
// B→A), runs personalized PageRank seeded by the current task's mentioned files/identifiers, and
// renders the top files' DEFINED-symbol signatures within a token budget. Gives an agent a
// relevance-ranked skeleton of the whole repo in ~1k tokens instead of blind grep-and-read.
// Pure JS power-iteration — zero deps, no embeddings.
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../lib/walk');
const { defsIn, SRC } = require('./symbols');

// Build: per-file defined symbols + which OTHER files reference them. Edge weight = ref count.
function buildRefGraph(root, opts = {}) {
  const exts = opts.exts || SRC;
  let files = []; try { files = walk(root, { include: exts }); } catch {}
  files = files.filter((f) => !/\.(test|spec)\.[tj]sx?$|\.d\.ts$/.test(f));
  const recs = [];
  for (const abs of files) {
    let content = ''; try { content = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    recs.push({ file: rel, content, defs: defsIn(content) });
  }
  // symbol -> defining file (first definer wins; ambiguous names get diluted but that's fine for ranking)
  const owner = new Map();
  for (const r of recs) for (const name of r.defs.keys()) if (!owner.has(name)) owner.set(name, r.file);
  // edges: file -> {definerFile: weight}. Tokenize each file ONCE and look up owned symbols (O(total
  // tokens), not O(files × symbols) — the latter melts on large repos). Weight = distinct-symbol count.
  const adj = new Map(recs.map((r) => [r.file, new Map()]));
  for (const r of recs) {
    const e = adj.get(r.file);
    const counts = new Map();
    const toks = r.content.match(/[A-Za-z_$][\w$]*/g) || [];
    for (const tok of toks) { if (tok.length < 3) continue; const def = owner.get(tok); if (def && def !== r.file) counts.set(def, (counts.get(def) || 0) + 1); }
    for (const [def, c] of counts) e.set(def, c);
  }
  return { recs, owner, adj };
}

// Personalized PageRank over the file graph. `seeds` = {file: weight} bias vector.
function pagerank(adj, { seeds = {}, damping = 0.85, iters = 30 } = {}) {
  const files = [...adj.keys()];
  const n = files.length || 1;
  const idx = new Map(files.map((f, i) => [f, i]));
  // personalization vector
  let p = new Array(n).fill(0);
  const seedKeys = Object.keys(seeds).filter((f) => idx.has(f));
  if (seedKeys.length) { const tot = seedKeys.reduce((s, f) => s + (seeds[f] || 1), 0); for (const f of seedKeys) p[idx.get(f)] = (seeds[f] || 1) / tot; }
  else p = new Array(n).fill(1 / n);
  // out-weight sums
  const out = files.map((f) => { let s = 0; for (const w of adj.get(f).values()) s += w; return s; });
  let rank = new Array(n).fill(1 / n);
  for (let it = 0; it < iters; it++) {
    const next = new Array(n).fill(0);
    // teleport / dangling mass
    for (let i = 0; i < n; i++) next[i] += (1 - damping) * p[i];
    let dangling = 0;
    for (let i = 0; i < n; i++) if (out[i] === 0) dangling += rank[i];
    for (let i = 0; i < n; i++) next[i] += damping * dangling * p[i];
    for (const f of files) {
      const i = idx.get(f), oi = out[i]; if (oi === 0) continue;
      const share = damping * rank[i] / oi;
      for (const [to, w] of adj.get(f)) next[idx.get(to)] += share * w;
    }
    rank = next;
  }
  return files.map((f, i) => ({ file: f, score: rank[i] })).sort((a, b) => b.score - a.score);
}

// crude token estimate (~4 chars/token)
const toks = (s) => Math.ceil(String(s).length / 4);

// Render top-ranked files' signatures into a budget.
function renderRepoMap(root, { task = '', budgetTokens = 1200, exts } = {}) {
  const { recs, adj } = buildRefGraph(root, { exts });
  const byFile = new Map(recs.map((r) => [r.file, r]));
  // seeds from task: any file path fragment or identifier mentioned
  const seeds = {};
  const lower = String(task).toLowerCase();
  for (const r of recs) {
    if (task && lower.includes(r.file.toLowerCase())) seeds[r.file] = 50;
    else { for (const name of r.defs.keys()) { if (name.length > 3 && new RegExp('\\b' + name + '\\b', 'i').test(task)) { seeds[r.file] = (seeds[r.file] || 0) + 10; } } }
  }
  const ranked = pagerank(adj, { seeds });
  const lines = ['# Repo map (PageRank-ranked, budgeted)', task ? `_Task: ${task}_` : '_whole-repo skeleton_', ''];
  let used = toks(lines.join('\n'));
  let shown = 0;
  for (const { file } of ranked) {
    const r = byFile.get(file); if (!r || !r.defs.size) continue;
    const sig = [`## ${file}`, ...[...r.defs.keys()].slice(0, 12).map((n) => `  - ${n}`)].join('\n');
    const cost = toks(sig);
    if (used + cost > budgetTokens && shown > 0) break;
    lines.push(sig, ''); used += cost; shown++;
  }
  return { markdown: lines.join('\n'), files: shown, tokensUsed: used, ranked };
}

module.exports = { buildRefGraph, pagerank, renderRepoMap };
