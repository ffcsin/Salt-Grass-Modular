// src/render-area.js
function table(header, rows) {
  return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function renderArea(b) {
  const lines = [
    `# Area: ${b.area}`, '',
    `> Machine-generated from \`map.json\`. Do not edit — it is regenerated each run.`,
    `> Intent / why / gotchas (human-owned): [\`../intent/${b.area}.md\`](../intent/${b.area}.md)`, '',
    `## Routes (${b.routes.length})`, '',
    table(['Method', 'Route', 'Handler', 'Source'],
      b.routes.map((r) => [r.method, `\`${r.route}\``, `\`${r.handler || ''}\``, `${r.file}:${r.line}`])), '',
    `## Frontend calls (${b.feCalls.length})`, '',
    table(['Caller', 'Method', 'URL', 'Route'],
      b.feCalls.map((w) => [`${w.from.file}:${w.from.line}`, w.method, `\`${w.url}\``, `\`${w.route || ''}\``])), '',
    `## Orphan routes — no caller (${b.orphans.routesNoCaller.length})`, '',
    table(['Method', 'Route', 'Source'],
      b.orphans.routesNoCaller.map((r) => [r.method, `\`${r.route}\``, `${r.file}:${r.line}`])),
  ];
  if (b.surfaces.length) {
    lines.push('', `## Surfaces (${b.surfaces.length})`, '',
      table(['Kind', 'Source'], b.surfaces.map((s) => [s.kind, `${s.file}:${s.line}`])));
  }
  return lines.join('\n') + '\n';
}

module.exports = { renderArea };
