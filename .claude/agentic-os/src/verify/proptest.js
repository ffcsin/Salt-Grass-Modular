'use strict';
// Property-based testing (lightweight, zero-dep). Generates many inputs (random + edge values),
// checks a property, and SHRINKS a failing input to a minimal counterexample. PBT catches logic bugs
// example-based tests miss — the highest-value class of AI-generated test. The invariant INFERENCE is
// the LLM/skill half (see skills/property-test); this is the engine it drives. Not fast-check-grade
// (no stateful model testing) but covers the stateless-property 80%.

// Deterministic PRNG (seeded) so runs are reproducible without Math.random.
function makeRng(seed = 123456789) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

const EDGE_INTS = [0, 1, -1, 2, -2, 100, -100, 2147483647, -2147483648];
const EDGE_STRINGS = ['', ' ', 'a', 'A', '0', '\n', '\t', 'null', 'undefined', '👍', 'a'.repeat(100), '"', '\\', '<script>'];

const gen = {
  int: (rng) => Math.floor((rng() - 0.5) * 2_000_000),
  nat: (rng) => Math.floor(rng() * 10000),
  string: (rng) => { const n = Math.floor(rng() * 20); let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(32 + Math.floor(rng() * 94)); return s; },
  bool: (rng) => rng() < 0.5,
  array: (inner) => (rng) => { const n = Math.floor(rng() * 8); return Array.from({ length: n }, () => inner(rng)); },
};

function edgeCasesFor(kind) {
  if (kind === 'int' || kind === 'nat') return EDGE_INTS;
  if (kind === 'string') return EDGE_STRINGS;
  if (kind === 'bool') return [true, false];
  return [];
}

function shrinkInt(x) { const out = []; if (x !== 0) out.push(0); if (Math.abs(x) > 1) out.push(Math.trunc(x / 2)); if (x > 0) out.push(x - 1); if (x < 0) out.push(x + 1); return out; }
function shrinkString(s) { const out = []; if (s.length) { out.push(''); out.push(s.slice(0, Math.floor(s.length / 2))); out.push(s.slice(1)); } return out; }
function shrink(val) { if (typeof val === 'number') return shrinkInt(val); if (typeof val === 'string') return shrinkString(val); if (Array.isArray(val)) return val.length ? [[], val.slice(0, Math.floor(val.length / 2))] : []; return []; }

// check: property(input)->boolean. kind picks the generator. Returns {ok, counterexample, runs}.
function check(property, { kind = 'int', runs = 200, seed = 123456789 } = {}) {
  const rng = makeRng(seed);
  const g = gen[kind] || gen.int;
  const inputs = [...edgeCasesFor(kind)];
  for (let i = 0; i < runs; i++) inputs.push(g(rng));
  for (const input of inputs) {
    let ok = true;
    try { ok = property(input) !== false; } catch { ok = false; }
    if (!ok) {
      // shrink to a minimal failing input
      let best = input;
      let improved = true;
      while (improved) {
        improved = false;
        for (const cand of shrink(best)) {
          let bad = false;
          try { bad = property(cand) === false; } catch { bad = true; }
          if (bad) { best = cand; improved = true; break; }
        }
      }
      return { ok: false, counterexample: best, original: input, runs: inputs.length };
    }
  }
  return { ok: true, runs: inputs.length };
}

module.exports = { check, makeRng, gen, shrink, edgeCasesFor };
