// src/warnings.js
// The warnings/parked layer (an established pattern). Surfaces three classes from the deep-map:
//  - orphan routes (BE endpoints with no FE caller) — candidates for removal OR intentionally-parked
//  - unmatched FE calls (call a route the map can't find) — likely a bug or a dynamic URL
//  - dead-code findings (the agent flagged unused code)
// "Parked" = intentionally-kept-but-unwired, which needs a human sign-off (so we don't auto-delete
// something deliberate). orphans.md lists candidates; parked.md is the sign-off ledger.
function buildWarnings(deepMap) {
  const orphanRoutes = ((deepMap.orphans && deepMap.orphans.routesNoCaller) || [])
    .map((r) => ({ method: r.method, route: r.route, file: r.file, line: r.line }));
  const unmatchedCalls = ((deepMap.orphans && deepMap.orphans.feCallsUnmatched) || [])
    .map((w) => ({ method: w.method, url: w.url, file: w.from && w.from.file, line: w.from && w.from.line }));
  const deadCode = [];
  for (const f of deepMap.files || []) for (const x of f.findings || []) if (x.kind === 'dead-code') deadCode.push({ file: f.file, line: x.line, note: x.note });
  return { orphanRoutes, unmatchedCalls, deadCode };
}

function orphansMarkdown(w) {
  return [
    '# Orphans & unmatched (review candidates)', '',
    `## Orphan routes — ${w.orphanRoutes.length} (BE endpoints with no detected FE caller)`, '',
    '_Either dead, dynamically/externally called, or intentionally parked. Move confirmed-intentional ones to `parked.md` with a sign-off._', '',
    ...w.orphanRoutes.slice(0, 300).map((r) => `- \`${r.method || 'ANY'} ${r.route}\` — ${r.file}:${r.line}`),
    '', `## Unmatched FE calls — ${w.unmatchedCalls.length} (call a route the map can't resolve)`, '',
    '_Likely a real bug (wrong path/method) OR a dynamic URL the extractor can\'t follow. Verify each._', '',
    ...w.unmatchedCalls.slice(0, 200).map((c) => `- \`${c.method || 'GET'} ${c.url}\` — ${c.file}:${c.line}`),
    '', `## Dead-code findings — ${w.deadCode.length}`, '',
    ...w.deadCode.slice(0, 200).map((d) => `- ${d.file}:${d.line} — ${String(d.note).slice(0, 160)}`),
  ].join('\n') + '\n';
}

function parkedScaffold(existing) {
  if (existing && existing.includes('# Parked')) return existing; // never clobber human sign-offs
  return [
    '# Parked components (intentionally kept, not wired)', '',
    'Move an entry here from `orphans.md` ONCE a human confirms it is deliberate (e.g. a feature behind',
    'a flag, a public API, a future-use module). This is the sign-off ledger so nothing parked gets',
    'auto-deleted. Format:', '',
    '| Item | Why parked | Signed-off-by | Date |', '| --- | --- | --- | --- |',
    '| _example: `GET /api/legacy/x`_ | _kept for external partner_ | _you_ | _YYYY-MM-DD_ |', '',
  ].join('\n') + '\n';
}

module.exports = { buildWarnings, orphansMarkdown, parkedScaffold };
