'use strict';
// Diff-aware mutation sentinel (core). The 2026 defense against "AI-written tests that pass on broken
// code": mechanically mutate the code, re-run the tests — if green SURVIVES the mutant, the tests
// don't constrain that behavior (vacuous coverage). This module is the pure mutation GENERATOR +
// survival summary; the bin orchestrates (write mutant → run repo tests → restore). Severity-tiered +
// diff-scoped so the campaign stays bounded. Zero deps.

// Operator mutations, highest-severity first (boundary/logic flips catch the most).
const OPERATORS = [
  { re: /===/g, to: '!==', sev: 3, desc: 'strict-equality flip' },
  { re: /!==/g, to: '===', sev: 3, desc: 'strict-inequality flip' },
  { re: /&&/g, to: '||', sev: 3, desc: 'and→or' },
  { re: /\|\|/g, to: '&&', sev: 3, desc: 'or→and' },
  { re: />=/g, to: '<', sev: 3, desc: 'gte→lt (boundary)' },
  { re: /<=/g, to: '>', sev: 3, desc: 'lte→gt (boundary)' },
  { re: /\btrue\b/g, to: 'false', sev: 2, desc: 'true→false' },
  { re: /\bfalse\b/g, to: 'true', sev: 2, desc: 'false→true' },
  { re: / \+ /g, to: ' - ', sev: 1, desc: 'plus→minus' },
  { re: / - /g, to: ' + ', sev: 1, desc: 'minus→plus' },
];

// Generate one mutant per operator occurrence (each mutant flips exactly ONE site).
function generateMutants(source, opts = {}) {
  const max = opts.max || 40;
  const lines = String(source || '').split('\n');
  const mutants = [];
  for (let li = 0; li < lines.length && mutants.length < max; li++) {
    const line = lines[li];
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // skip comment lines
    for (const op of OPERATORS) {
      op.re.lastIndex = 0;
      let m;
      while ((m = op.re.exec(line)) !== null && mutants.length < max) {
        const col = m.index;
        const mutatedLine = line.slice(0, col) + op.to + line.slice(col + m[0].length);
        const copy = lines.slice(); copy[li] = mutatedLine;
        mutants.push({ id: `${li + 1}:${col}:${op.desc}`, line: li + 1, sev: op.sev, desc: op.desc, before: m[0], after: op.to, source: copy.join('\n') });
        if (op.re.global) break; // one mutant per operator per line (keep bounded)
      }
    }
  }
  // highest severity first, so a budget-capped run checks the most-telling mutants
  return mutants.sort((a, b) => b.sev - a.sev);
}

// results: [{id, killed}] -> summary. A surviving mutant = a coverage gap.
function summarize(results) {
  const total = results.length;
  const killed = results.filter((r) => r.killed).length;
  const survivors = results.filter((r) => !r.killed);
  return { total, killed, survived: survivors.length, score: total ? killed / total : 1, survivors };
}

module.exports = { OPERATORS, generateMutants, summarize };
