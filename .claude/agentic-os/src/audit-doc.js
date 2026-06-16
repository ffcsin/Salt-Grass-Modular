'use strict';
// Tool-audit-depth doc generator — reproduces the reference implementation's 9-section audit structure. Everything
// deterministic (BE/FE inventory with guards+params+file:line, tier matrix from gates, gap-analysis
// stubs from orphans/no-auth, recently-fixed from git, cross-refs) is FILLED; the two genuinely
// semantic sections (Intent why/who, Tech Debt prioritization) are scaffolded with AGENT-NEEDED
// markers + inline prompts for the enrich pass. This is the bar the reference implementation's agent-built audits set.

const AGENT = '<!-- agentic-os:agent-needed -->';

function table(header, rows) {
  return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}
const cite = (f, l) => `\`${f}:${l}\``;
const plist = (p) => p ? [...(p.path || []).map((x) => ':' + x), ...(p.query || []).map((x) => '?' + x), ...(p.body || []).map((x) => x)].join(', ') : '';

// b = area object from group(); ctx = { guardsByRoute, recentlyFixed, gates, related, feButtons }
function renderAuditDoc(b, ctx = {}) {
  const area = b.area;
  const g = ctx.guardsByRoute || new Map();
  const enrich = (r) => g.get(`${r.method} ${r.route}`) || g.get(r.route) || null;
  const noAuth = b.routes.filter((r) => { const e = enrich(r); return e && (!e.guards || e.guards.length === 0); });
  const guarded = b.routes.filter((r) => { const e = enrich(r); return e && e.guards && e.guards.length; });

  const L = [];
  L.push(`# ${area} — Tool Audit`, '');
  L.push(`**Status:** auto-generated structural audit · ${b.routes.length} route(s) · ${b.feCalls.length} FE call(s) · ${guarded.length} guarded / ${noAuth.length} no-auth`, '');

  // 1. Intent (AGENT)
  L.push('## Intent', '', AGENT,
    `**Why this exists:** _[agent: what business need does \`${area}\` serve?]_`,
    `**Who uses it:** _[agent: which roles/tiers — derive hints from the guards below]_`,
    `**What problem it solves:** _[agent: the core concern this area owns]_`, '');

  // 2. Intended Behavior (AGENT)
  L.push('## Intended Behavior', '', AGENT,
    `_[agent: happy path, failure modes, and any multi-mode split (e.g. admin vs standalone). The route + call tables below are the raw material.]_`, '');

  // 3. Tier Matrix (deterministic from gates, else N/A)
  L.push('## Tier Matrix', '');
  if (ctx.gates && ctx.gates.length) {
    L.push(table(['Gate kind', 'Requires', 'Source'], ctx.gates.slice(0, 20).map((x) => [x.kind, `\`${x.value}\``, cite(x.file, x.line)])), '');
  } else L.push('_N/A — no tier/feature gates detected in this area._', '');

  // 4. BE Inventory (deterministic: routes + guards + params)
  L.push(`## BE Inventory (${b.routes.length} routes)`, '');
  if (b.routes.length) L.push(table(['Method', 'Route', 'Guards', 'Params', 'Source'],
    b.routes.map((r) => { const e = enrich(r); return [r.method, `\`${r.route}\``, e && e.guards && e.guards.length ? e.guards.join(', ') : '🔓 none', e ? plist(e.params) : '', cite(r.file, r.line)]; })), '');
  else L.push('_No backend routes in this area._', '');

  // 5. FE Inventory (deterministic: calls + buttons)
  L.push(`## FE Inventory (${b.feCalls.length} calls`, ctx.feButtons ? `, ${ctx.feButtons.length} buttons)` : ')', '');
  if (b.feCalls.length) L.push(table(['Caller', 'Method', 'URL', '→ Route'],
    b.feCalls.slice(0, 60).map((w) => [cite(w.from.file, w.from.line), w.method, `\`${w.url}\``, `\`${w.route || ''}\``])), '');
  if (ctx.feButtons && ctx.feButtons.length) L.push('', '**Interactive elements:**', table(['Kind', 'Label', 'Handler', 'Source'],
    ctx.feButtons.slice(0, 40).map((x) => [x.kind, x.label || '', `\`${(x.handler || '').slice(0, 40)}\``, cite(x.file, x.line)])), '');
  if (!b.feCalls.length && !(ctx.feButtons && ctx.feButtons.length)) L.push('_No FE surfaces mapped to this area._', '');
  L.push('');

  // 6. Gap Analysis (deterministic stubs + AGENT row)
  L.push('## Gap Analysis', '');
  const gaps = [];
  if (b.orphans.routesNoCaller.length) gaps.push([`G-orphan`, `${b.orphans.routesNoCaller.length} route(s) with no detected FE caller`, '⚠️ verify (may be cron/webhook/public)', 'Med']);
  if (noAuth.length) gaps.push([`G-noauth`, `${noAuth.length} route(s) with no per-route guard`, '🔓 verify: intended-public vs missing-auth vs covered by a GLOBAL guard/middleware (extractor sees only per-route decorators)', 'High']);
  gaps.push([`G-agent`, '_[agent: documented-vs-shipped gaps from reading the code]_', `${AGENT}`, '—']);
  L.push(table(['#', 'Gap', 'Finding', 'Severity'], gaps), '');
  if (b.orphans.routesNoCaller.length) { L.push('<details><summary>Orphan routes (no caller)</summary>', '', ...b.orphans.routesNoCaller.slice(0, 30).map((r) => `- \`${r.method} ${r.route}\` ${cite(r.file, r.line)}`), '', '</details>', ''); }

  // 7. Tech Debt (AGENT)
  L.push('## Tech Debt', '', AGENT, '_[agent: prioritized cleanup — what blocks the most, what customers hit]_', '');

  // 8. Recently Fixed (deterministic from git)
  L.push('## Recently Fixed', '');
  if (ctx.recentlyFixed && ctx.recentlyFixed.length) L.push(...ctx.recentlyFixed.slice(0, 5).map((c) => `- **${c.date} (\`${c.sha}\`)** — ${c.subject}`), '');
  else L.push('_No recent fix/feat commits found for this area\'s paths._', '');

  // 9. Cross-references (deterministic: areas this area calls into)
  L.push('## Cross-references', '');
  if (ctx.related && ctx.related.length) L.push(...ctx.related.slice(0, 12).map((a) => `- [\`${a}\`](./${a}.md)`), '');
  else L.push('_No cross-area calls detected._', '');

  return L.filter((x) => x !== undefined).join('\n') + '\n';
}

// Completeness scoring (the reference implementation audit-completeness parity): per-section richness → 0..3, summed.
const SECTIONS = ['Intent', 'Intended Behavior', 'Tier Matrix', 'BE Inventory', 'FE Inventory', 'Gap Analysis', 'Tech Debt', 'Recently Fixed', 'Cross-references'];
function scoreAudit(md) {
  const text = String(md || '');
  let total = 0; const per = {};
  for (const s of SECTIONS) {
    const re = new RegExp(`^##+ ${s.replace(/[()]/g, '.')}.*$`, 'm');
    const m = re.exec(text);
    if (!m) { per[s] = 0; continue; }
    const start = m.index + m[0].length;
    const nextH = text.slice(start).search(/\n##+ /);
    const body = nextH === -1 ? text.slice(start) : text.slice(start, start + nextH);
    const words = (body.match(/\w+/g) || []).length;
    const rows = (body.match(/^\|/gm) || []).length;
    const cites = (body.match(/`[^`]+:\d+`/g) || []).length;
    const agentStub = body.includes(AGENT) && words < 40;
    const richness = words + rows * 5 + cites * 8;
    let score = 1;
    if (rows >= 3 || cites >= 1 || richness >= 80) score = 2; // a real table / citation / prose = filled
    if (richness >= 250) score = 3;
    if (agentStub) score = 1; // an unfilled agent section is a stub regardless
    per[s] = score; total += score;
  }
  return { total, max: SECTIONS.length * 3, per };
}

module.exports = { renderAuditDoc, scoreAudit, SECTIONS, AGENT };
