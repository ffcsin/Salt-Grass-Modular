'use strict';
// Golden-set regression gate (core). Freeze reference outputs for the repo's critical paths; on each
// preflight re-run the fixed inputs and diff against the baseline. For non-deterministic surfaces
// (LLM-backed endpoints), score CONSISTENCY across N runs (variance band) instead of exact-match, so
// legitimate variance passes but real instability fails. This module is the pure diff + band logic;
// the bin shells out to the repo's entrypoints to produce actual outputs. Zero deps.

// Structural deep diff. Returns [] if equal, else list of {path, expected, actual}.
function diffValue(expected, actual, p = '') {
  const out = [];
  const te = typeof expected, ta = typeof actual;
  if (expected === null || actual === null || te !== 'object' || ta !== 'object') {
    if (!Object.is(expected, actual)) out.push({ path: p || '.', expected, actual });
    return out;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) { out.push({ path: p, expected, actual }); return out; }
    if (expected.length !== actual.length) out.push({ path: p + '.length', expected: expected.length, actual: actual.length });
    for (let i = 0; i < Math.max(expected.length, actual.length); i++) out.push(...diffValue(expected[i], actual[i], `${p}[${i}]`));
    return out;
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const k of keys) out.push(...diffValue(expected[k], actual[k], p ? `${p}.${k}` : k));
  return out;
}

// Consistency band for numeric samples: mean, stddev, and whether variance is within tolerance.
function consistencyBand(samples, { maxStddevRatio = 0.15 } = {}) {
  const nums = samples.filter((x) => typeof x === 'number' && !Number.isNaN(x));
  if (!nums.length) return { mean: null, stddev: null, stable: false, n: 0 };
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  const stddev = Math.sqrt(variance);
  const ratio = mean !== 0 ? stddev / Math.abs(mean) : (stddev === 0 ? 0 : 1);
  return { mean, stddev, ratio, stable: ratio <= maxStddevRatio, n: nums.length };
}

// Compare one golden case. case = {name, expected}. actual = produced value.
function checkCase(golden, actual) {
  const diffs = diffValue(golden.expected, actual);
  return { name: golden.name, pass: diffs.length === 0, diffs };
}

module.exports = { diffValue, consistencyBand, checkCase };
