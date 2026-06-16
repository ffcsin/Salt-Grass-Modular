'use strict';
// Behavioral-diff classifier. Tells a reviewer WHICH hunks can actually change runtime behavior vs
// which are noise (whitespace, comments, pure renames). Reviewers (human + AI) waste attention on
// formatting and miss the one hunk that flips a branch condition. Also flags the inverse: a hunk the
// agent called "just a refactor" that actually changes behavior. AST-normalization-lite, zero deps.

// Normalize a code string for behavioral comparison: strip comments, collapse whitespace, drop
// trailing semicolons/commas. What remains is the behavioral skeleton.
function normalize(code) {
  return String(code || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')      // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')   // line comments (not protocol-relative //)
    .replace(/\s+/g, ' ')
    .replace(/\s*([;,{}()[\]])\s*/g, '$1')
    .trim();
}

// Is the difference purely a consistent identifier rename? (heuristic: same token shape, one identifier
// swapped throughout). Returns the {from,to} rename or null.
function detectRename(beforeN, afterN) {
  const tok = (s) => s.match(/[A-Za-z_$][\w$]*|[^A-Za-z_$\s]+/g) || [];
  const b = tok(beforeN), a = tok(afterN);
  if (b.length !== a.length) return null;
  const map = new Map();
  for (let i = 0; i < b.length; i++) {
    if (b[i] === a[i]) continue;
    if (!/^[A-Za-z_$][\w$]*$/.test(b[i]) || !/^[A-Za-z_$][\w$]*$/.test(a[i])) return null; // non-identifier change = behavioral
    if (map.has(b[i]) && map.get(b[i]) !== a[i]) return null;
    map.set(b[i], a[i]);
  }
  return map.size === 1 ? { from: [...map.keys()][0], to: [...map.values()][0] } : (map.size === 0 ? null : null);
}

// Classify a before/after pair. -> {kind: 'neutral'|'rename'|'behavioral', detail}
function classifyHunk(before, after) {
  const bN = normalize(before), aN = normalize(after);
  if (bN === aN) return { kind: 'neutral', detail: 'whitespace/comment only' };
  const rn = detectRename(bN, aN);
  if (rn) return { kind: 'rename', detail: `consistent rename ${rn.from}→${rn.to}`, rename: rn };
  return { kind: 'behavioral', detail: 'structural change — review this' };
}

// Classify a whole unified diff into per-file behavioral/neutral buckets.
function classifyDiff(unified) {
  const files = [];
  let cur = null;
  const flush = () => { if (cur && (cur.added.length || cur.removed.length)) files.push(cur); };
  for (const line of String(unified || '').split('\n')) {
    const fm = line.match(/^\+\+\+ b\/(.+)/);
    if (fm) { flush(); cur = { file: fm[1], added: [], removed: [] }; continue; }
    if (!cur) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) cur.added.push(line.slice(1));
    else if (line.startsWith('-') && !line.startsWith('---')) cur.removed.push(line.slice(1));
  }
  flush();
  return files.map((f) => ({ file: f.file, ...classifyHunk(f.removed.join('\n'), f.added.join('\n')) }));
}

module.exports = { normalize, detectRename, classifyHunk, classifyDiff };
