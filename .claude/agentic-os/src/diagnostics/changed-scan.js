'use strict';
// Diagnostic bug-finder over the SESSION's changed files — runs the existing deterministic scanners
// (cross-store consistency, async correctness, hallucinated imports) on just the files touched this
// session and surfaces NEW findings at Stop. Cheap (regex/AST, no LLM, no $ cost), always-on, complements
// the headless auto-reviewer (which costs tokens). This is the "diagnostic bug finder" hook: it catches
// the high-value bug classes — e.g. for example, a new PG+TigerBeetle write with no idempotency — at the
// moment work wraps up, deterministically.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Files changed vs HEAD (committed + working-tree). Bounded.
function changedFiles(root, cap = 60) {
  const out = new Set();
  for (const args of [['diff', '--name-only', 'HEAD'], ['diff', '--name-only'], ['ls-files', '--others', '--exclude-standard']]) {
    try { for (const f of execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\n')) { const t = f.trim(); if (t) out.add(t); } } catch {}
    if (out.size >= cap) break;
  }
  return [...out].slice(0, cap);
}

const SRC_RE = /\.(go|ts|tsx|js|jsx|mjs|cjs|py)$/;
function scanChanged(root, files) {
  const findings = [];
  for (const rel of (files || [])) {
    if (!SRC_RE.test(rel) || /(_test\.go$|\.(test|spec)\.|\/(vendor|node_modules|generated)\/)/.test(rel)) continue;
    const abs = path.join(root, rel);
    let content = ''; try { content = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    // cross-store write consistency (this bug class)
    try { for (const f of require('./store-consistency').scanStoreConsistency(content, rel)) findings.push({ sev: f.severity, file: rel, line: f.line, kind: 'store-consistency', msg: `multi-store write (${(f.stores || []).join('+')}) — ${f.pattern}` }); } catch {}
    // async correctness (js/ts)
    try { for (const b of require('./async-bugs').scanAsyncBugs(content, rel)) findings.push({ sev: 'Med', file: rel, line: b.line, kind: 'async', msg: b.kind }); } catch {}
    // hallucinated/unresolved local imports
    try { for (const u of require('./unresolved-imports').scanUnresolvedImports(abs, content)) findings.push({ sev: 'High', file: rel, line: 0, kind: 'import', msg: `unresolved import ${u}` }); } catch {}
  }
  const order = { High: 0, Med: 1, Medium: 1, Low: 2 };
  findings.sort((a, b) => (order[a.sev] ?? 3) - (order[b.sev] ?? 3));
  return findings;
}

// Stop-time entry: scan the session's changed files → a short advisory string (top findings), or null.
function diagnoseChanged(root, max = 8) {
  const findings = scanChanged(root, changedFiles(root));
  if (!findings.length) return null;
  const shown = findings.slice(0, max).map((f) => `  ${f.sev} | ${f.file}${f.line ? ':' + f.line : ''} | ${f.msg}`);
  const more = findings.length > max ? `\n  …+${findings.length - max} more` : '';
  return `[agentic-os] Diagnostic scan of your changed files flagged ${findings.length} potential issue(s) — verify each:\n${shown.join('\n')}${more}`;
}

module.exports = { changedFiles, scanChanged, diagnoseChanged };
