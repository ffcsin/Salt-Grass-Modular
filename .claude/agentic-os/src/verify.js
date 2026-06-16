// src/verify.js
const DEFAULT_BARS = { precision: 0.95, drift: 0.10 };

function computeDrift(rawMap, independentCounts, bars = DEFAULT_BARS) {
  const drift = {};
  let maxDrift = 0;
  for (const cat of ['feCalls', 'routes', 'surfaces']) {
    const got = (rawMap[cat] || []).length;
    const exp = independentCounts[cat] || 0;
    const denom = Math.max(got, exp, 1);
    const d = Math.abs(got - exp) / denom;
    drift[cat] = d;
    if (d > maxDrift) maxDrift = d;
  }
  return { drift, maxDrift, precision: null, healRounds: 0, trusted: false, bars };
}

function gate(report) {
  const trusted = report.precision != null
    && report.precision >= report.bars.precision
    && report.maxDrift < report.bars.drift;
  return { ...report, trusted };
}

function applyPrecision(report, precision) {
  return gate({ ...report, precision });
}

module.exports = { computeDrift, gate, applyPrecision, DEFAULT_BARS };
