// src/line-correct.js
// Pick a stable literal token from a route/url id (strip method prefix, ${...}, :params; take longest segment).
function needleOf(s) {
  if (!s) return '';
  let t = String(s).replace(/^[A-Z]+\s+/, '').replace(/\$\{[^}]+\}/g, '').split('?')[0];
  const segs = t.split(/[\/]/).filter((x) => x && !x.startsWith(':'));
  // take the last (deepest/leaf) segment — most specific, best needle for line search
  return segs[segs.length - 1] || '';
}
// Progressively-shorter literal needles, most-specific first, so a distinctive path
// (e.g. 'api/billing/config') is tried before an ambiguous leaf ('config').
function candidateNeedles(s) {
  if (!s) return [];
  const t = String(s).replace(/^[A-Z]+\s+/, '').replace(/\$\{[^}]+\}/g, '').split('?')[0];
  const segs = t.split(/[\/]/).filter((x) => x && !x.startsWith(':'));
  const out = [];
  for (let i = 0; i < segs.length; i++) out.push(segs.slice(i).join('/')); // full suffix -> ... -> leaf
  return [...new Set(out)];
}
function hitsFor(lines, needle) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].includes(needle)) hits.push(i + 1);
  return hits;
}
function correctLine(content, claimedLine, needle) {
  if (!needle) return claimedLine;
  const hits = hitsFor(content.split('\n'), needle);
  if (!hits.length) return claimedLine;
  return hits.reduce((best, h) => (Math.abs(h - claimedLine) < Math.abs(best - claimedLine) ? h : best), hits[0]);
}
// Try candidates specific->general; use the first that yields hits, picking the hit nearest the claim.
function correctLineBest(content, claimedLine, idText) {
  const lines = content.split('\n');
  for (const needle of candidateNeedles(idText)) {
    const hits = hitsFor(lines, needle);
    if (hits.length) return hits.reduce((best, h) => (Math.abs(h - claimedLine) < Math.abs(best - claimedLine) ? h : best), hits[0]);
  }
  return claimedLine;
}
function lineCorrectInventory(inv, content) {
  const fix = (items, idKey) => (items || []).map((it) => ({ ...it, line: correctLineBest(content, it.line || 0, it[idKey]) }));
  return { ...inv, connectionsOut: fix(inv.connectionsOut, 'target'), exposesEndpoints: fix(inv.exposesEndpoints, 'id') };
}
module.exports = { correctLine, correctLineBest, lineCorrectInventory, needleOf, candidateNeedles };
