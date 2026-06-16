// src/render.js
function table(header, rows) {
  const sep = header.map(() => '---');
  return [`| ${header.join(' | ')} |`, `| ${sep.join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function render(wm) {
  const inventory = [
    '# Ecosystem Inventory', '',
    table(['Category', 'Count'], [
      ['Frontend surfaces', wm.surfaces.length],
      ['Frontend calls', wm.feCalls.length],
      ['Backend routes', wm.routes.length],
    ]), '',
    '## Routes', '',
    table(['Method', 'Route', 'Handler', 'Source'],
      wm.routes.map((r) => [r.method, `\`${r.route}\``, `\`${r.handler}\``, `${r.file}:${r.line}`])),
  ].join('\n') + '\n';

  const counts = { matched: 0, unmatched: 0, external: 0 };
  for (const w of wm.wireup) counts[w.match] = (counts[w.match] || 0) + 1;
  const wireup = [
    '# FE↔BE Wireup', '',
    table(['Match', 'Count'], Object.entries(counts).map(([k, v]) => [k, v])), '',
    '## Matched', '',
    table(['FE call', 'Method', 'Route'],
      wm.wireup.filter((w) => w.match === 'matched').map((w) => [`${w.from.file}:${w.from.line}`, w.method, `\`${w.route}\``])),
  ].join('\n') + '\n';

  const orphans = [
    '# Orphans — triage queue', '',
    '> Nothing here is auto-deleted. Verify before acting.', '',
    `## Routes with no FE caller (${wm.orphans.routesNoCaller.length})`, '',
    table(['Method', 'Route', 'Handler', 'Source'],
      wm.orphans.routesNoCaller.map((r) => [r.method, `\`${r.route}\``, `\`${r.handler}\``, `${r.file}:${r.line}`])), '',
    `## FE calls matching no route (${wm.orphans.feCallsUnmatched.length})`, '',
    table(['FE call', 'Method', 'URL'],
      wm.orphans.feCallsUnmatched.map((w) => [`${w.from.file}:${w.from.line}`, w.method, `\`${w.url}\``])),
  ].join('\n') + '\n';

  return { 'inventory.md': inventory, 'wireup.md': wireup, 'orphans.md': orphans };
}

module.exports = { render };
