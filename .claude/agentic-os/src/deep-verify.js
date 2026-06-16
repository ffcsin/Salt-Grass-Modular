// src/deep-verify.js
const DEFAULT_BAR = 0.95;
function selfCheckDrift(selfCheck, content) {
  const grep = (content.match(/\b\w*[Ff]etch\s*\(|axios\.\w+\s*\(/g) || []).length;
  const claimed = (selfCheck && selfCheck.httpCallsOut) || 0;
  const denom = Math.max(grep, claimed, 1);
  const drift = Math.abs(grep - claimed) / denom;
  return { ok: drift <= 0.1, grep, claimed, drift };
}
// Stronger than selfCheckDrift: instead of trusting the agent's OWN httpCallsOut count, count the
// REAL outbound network calls in the source (tight regex, comments stripped, refetch/prefetch
// excluded) and compare to how many http-call connectionsOut the inventory actually EMITTED. This
// catches the failure selfCheck misses — an agent confidently emitting too few calls. Returns
// { ok, network, emitted } where !ok means the file undercounts and should be re-extracted.
function countNetworkCalls(content) {
  const code = String(content || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  let n = 0;
  n += (code.match(/\baxios\s*\.\s*(get|post|put|delete|patch|request)\s*\(/g) || []).length;
  n += (code.match(/\baxios\s*\(/g) || []).length;
  n += (code.match(/\b(authFetch|apiFetch|httpClient|httpService)\s*\(/g) || []).length;
  n += (code.match(/(?<![A-Za-z])fetch\s*\(/g) || []).length; // bare fetch( — excludes refetch/prefetch via the lookbehind
  return n;
}
function completenessDrift(inventory, content) {
  const network = countNetworkCalls(content);
  const emitted = (inventory.connectionsOut || []).filter((c) => c.type === 'http-call').length;
  // undercount = enough real calls to matter AND emitted materially below them
  const ok = !(network >= 3 && emitted < network * 0.7 && network - emitted >= 3);
  return { ok, network, emitted };
}
function gateDeep({ precision, mismatches, bar = DEFAULT_BAR }) {
  return { trusted: precision != null && precision >= bar && (mismatches || 0) === 0, precision, mismatches, bar };
}
module.exports = { selfCheckDrift, completenessDrift, countNetworkCalls, gateDeep, DEFAULT_BAR };
