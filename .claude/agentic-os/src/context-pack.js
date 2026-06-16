'use strict';
// Dependency-aware context pack. For a file the agent is about to edit, assemble the surrounding
// call chain it needs — IMPORTERS (who calls into this file), CALLEES (what this file imports
// locally), and the nearest TEST files — rendered as elided signatures within a token budget. Turns
// the graph's impact/trace queries into a proactive push at edit time, so "edited X, missed caller Y"
// defects drop. Pure path-resolution over the repo (zero deps).
const fs = require('node:fs');
const path = require('node:path');
const { defsIn, importSpecsIn, SRC } = require('./symbols');
const W = require('../lib/walk');

const RESOLVE_EXT = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.js', '/index.tsx'];

// Resolve a relative import specifier from `fromFile` to a repo-relative path that exists.
function resolveLocal(root, fromFile, spec) {
  if (!/^[./]/.test(spec)) return null;
  const baseDir = path.dirname(path.join(root, fromFile));
  const target = path.resolve(baseDir, spec);
  for (const ext of RESOLVE_EXT) {
    const cand = target + ext;
    try { if (fs.statSync(cand).isFile()) return path.relative(root, cand).replace(/\\/g, '/'); } catch {}
  }
  return null;
}

function indexFiles(root, exts) {
  let files = []; try { files = W.walk(root, { include: exts || SRC }); } catch {}
  files = files.filter((f) => !/\.d\.ts$/.test(f));
  const recs = [];
  for (const abs of files) {
    let content = ''; try { content = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    recs.push({ file: rel, content, defs: [...defsIn(content).keys()], imports: importSpecsIn(content) });
  }
  return recs;
}

function buildContextPack(root, targetFile, opts = {}) {
  const rel = String(targetFile).replace(/\\/g, '/').replace(root.replace(/\\/g, '/') + '/', '');
  const recs = opts.recs || indexFiles(root, opts.exts);
  const byFile = new Map(recs.map((r) => [r.file, r]));
  const target = byFile.get(rel) || recs.find((r) => r.file.endsWith(rel));
  const targetRel = target ? target.file : rel;

  // CALLEES: target's local imports resolved.
  const callees = [];
  if (target) for (const spec of target.imports) { const r = resolveLocal(root, targetRel, spec); if (r && r !== targetRel) callees.push(r); }

  // IMPORTERS: any file whose import resolves to target.
  const importers = [];
  for (const r of recs) {
    if (r.file === targetRel) continue;
    for (const spec of r.imports) { if (resolveLocal(root, r.file, spec) === targetRel) { importers.push(r.file); break; } }
  }

  // TESTS: test files mentioning the basename.
  const base = targetRel.split('/').pop().replace(/\.[tj]sx?$/, '');
  const tests = recs.filter((r) => /\.(test|spec)\.[tj]sx?$/.test(r.file) && (r.content.includes(base) || r.imports.size && [...r.imports].some((s) => s.includes(base)))).map((r) => r.file);

  return { target: targetRel, callees: [...new Set(callees)], importers: [...new Set(importers)], tests: [...new Set(tests)] };
}

const toks = (s) => Math.ceil(String(s).length / 4);

function renderContextPack(root, targetFile, opts = {}) {
  const recs = opts.recs || indexFiles(root, opts.exts);
  const byFile = new Map(recs.map((r) => [r.file, r]));
  const pack = buildContextPack(root, targetFile, { recs });
  const budget = opts.budgetTokens || 900;
  const lines = [`# Context pack for ${pack.target}`, ''];
  const section = (title, files) => {
    if (!files.length) return;
    lines.push(`## ${title} (${files.length})`);
    for (const f of files.slice(0, opts.maxPerSection || 8)) {
      const r = byFile.get(f);
      const sig = r ? r.defs.slice(0, 8).join(', ') : '';
      lines.push(`- \`${f}\`${sig ? ` — ${sig}` : ''}`);
      if (toks(lines.join('\n')) > budget) break;
    }
    lines.push('');
  };
  section('Importers (who depends on this — your blast radius)', pack.importers);
  section('Local dependencies (what this file imports)', pack.callees);
  section('Tests covering this', pack.tests);
  return { markdown: lines.join('\n'), pack };
}

module.exports = { resolveLocal, buildContextPack, renderContextPack, indexFiles };
