const fs = require('node:fs');
const path = require('node:path');
const { hasEcosystem, loadPathToArea, areaForFile, loadAreaDoc, ecoDir } = require('../lib/eco');

// Summarize the rich audit doc into the load-bearing sections (the reference implementation's pre-edit-audit-load pattern):
// Status + Intent + Tier Matrix + Gap Analysis + Recently Fixed, capped to a token budget.
function summarizeAudit(md, cap) {
  const pick = (name, maxLines) => {
    const re = new RegExp(`^##+ ${name}.*$`, 'm'); const m = re.exec(md); if (!m) return '';
    const start = m.index; const nextH = md.slice(start + m[0].length).search(/\n##+ /);
    const body = nextH === -1 ? md.slice(start) : md.slice(start, start + m[0].length + nextH);
    return body.split('\n').slice(0, maxLines).join('\n');
  };
  const status = (md.match(/^\*\*Status:\*\*.*$/m) || [''])[0];
  const parts = [md.split('\n')[0], status, pick('Intent', 6), pick('Tier Matrix', 6), pick('Gap Analysis', 8), pick('Recently Fixed', 5)].filter(Boolean);
  let out = parts.join('\n\n');
  if (cap && out.length > cap) out = out.slice(0, cap) + '\n…(truncated — full audit: .ecosystem/audits/)';
  return out;
}

function loadAuditSummary(projectDir, area, cap) {
  try { const md = fs.readFileSync(path.join(ecoDir(projectDir), 'audits', area + '.md'), 'utf8'); return summarizeAudit(md, cap || 4000); } catch { return null; }
}

function preEditContext(projectDir, filePath, cap) {
  if (!hasEcosystem(projectDir) || !filePath) return null;
  const m = areaForFile(filePath, loadPathToArea(projectDir), projectDir);
  if (!m) return null;
  // Prefer the RICH audit summary (guards/gaps/recently-fixed); fall back to the area map doc.
  const doc = loadAuditSummary(projectDir, m.area, cap) || loadAreaDoc(projectDir, m.area, cap);
  if (!doc) return null;
  let learned = '';
  try {
    const hits = require('../../src/learnings').learningsFor(projectDir, { area: m.area, file: filePath }).slice(0, 6);
    if (hits.length) learned = `\n\nWhat this repo has learned here:\n${hits.map((l) => `- (${l.type}) ${l.text}`).join('\n')}`;
  } catch {}
  // Carry the TRUST-BUT-VERIFY caveat right at edit time — the audit is a MAP generated at bootstrap;
  // it can drift, miss dynamic/non-REST routes, or miss a globally-applied guard. The moment before an
  // edit is exactly when "confirm the cited file:line against the real handler" matters most (the reference implementation's
  // pre-edit-audit-load injects the same caveat).
  return `[agentic-os] Editing area "${m.area}". Audit below — but TRUST BUT VERIFY: this is a generated map, not the territory. Before relying on a routes/guards/params claim, open the cited file:line and confirm against the real handler; if they disagree, trust the CODE and note the drift.\n\n${doc}${learned}\n\nFull audit: .ecosystem/audits/${m.area}.md · Why/gotchas: .ecosystem/intent/${m.area}.md`;
}

// Standing per-prompt mandate (the reference implementation's docs-first-reminder.cjs). CLAUDE.md compresses mid-session, so
// the read-the-audit-then-verify discipline fades on long sessions; re-inject a TERSE one-liner every
// prompt when an ecosystem is present. Distinct from promptRouter (fires only on a keyword hit): this
// fires ALWAYS, keeping both mandates alive. One line, so it's a nudge not noise.
function docsFirstReminder(projectDir) {
  if (!hasEcosystem(projectDir)) return null;
  return '[agentic-os] Mandate: before editing/diagnosing a mapped area, (1) read its `.ecosystem/audits/<area>.md` FIRST, then (2) TRUST-BUT-VERIFY — open the cited file:line and confirm against the real code; the map can drift. Edits route through the read-before-edit gate.';
}
function promptRouter(projectDir, prompt) {
  if (!hasEcosystem(projectDir) || !prompt) return null;
  // Route on the full AUDIT vocabulary (not just the coarse path-to-area areas) so a prompt mentioning
  // "commissions"/"payments"/"clawbacks" surfaces the rich per-feature audit — those areas exist as
  // audits but aren't in the route-vote path-to-area map (a v1 connectivity gap).
  const areas = [...require('../lib/eco').knownAreas(projectDir)].filter((a) => a.length > 3 && a !== 'ungrouped' && a !== 'root' && a !== '-');
  const lower = prompt.toLowerCase();
  const hits = areas.filter((a) => new RegExp(`\\b${a.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(lower));
  if (!hits.length) return null;
  const ref = (a) => fs.existsSync(path.join(ecoDir(projectDir), 'audits', a + '.md')) ? `.ecosystem/audits/${a}.md` : `.ecosystem/areas/${a}.md`;
  return `[agentic-os] Mentions ${hits.join(', ')} — read first: ${hits.slice(0, 4).map(ref).join(', ')}`;
}
function postEditNudge(projectDir, filePath) {
  if (!hasEcosystem(projectDir) || !filePath) return null;
  const m = areaForFile(filePath, loadPathToArea(projectDir), projectDir);
  if (!m) return null;
  const hasAudit = fs.existsSync(path.join(ecoDir(projectDir), 'audits', m.area + '.md'));
  return `[agentic-os] Edited area "${m.area}". ${hasAudit ? `Update \`.ecosystem/audits/${m.area}.md\` if you changed routes/guards/params (flip a Gap Analysis row, add to Recently Fixed). ` : ''}If structure changed, re-run /agentic-os:bootstrap-ecosystem; update .ecosystem/intent/${m.area}.md if the "why" changed.`;
}

// New-file detector: warn when creating a source file in no mapped area (the reference implementation's new-file-detector —
// surfaces the docs gap at creation time, when it's cheap to fix). WARN only.
function newFileGap(projectDir, filePath, exists) {
  if (!hasEcosystem(projectDir) || !filePath || exists) return null;
  const rel = String(filePath).replace(/\\/g, '/');
  if (!/(src|app|apps|services|components|lib|server)\//.test(rel) || /\.(test|spec)\.|\.d\.ts$|__tests__/.test(rel)) return null;
  const m = areaForFile(filePath, loadPathToArea(projectDir), projectDir);
  if (m && m.area && m.area !== 'ungrouped' && m.area !== 'root') return null; // already in a mapped area
  return `[agentic-os] New file in an UNMAPPED area: \`${rel}\`. If this starts a new feature, after it lands: re-run /agentic-os:bootstrap-ecosystem so it gets an audit doc + path-to-area entry; add an intent doc for the "why".`;
}
function sessionSummary(projectDir) {
  if (!hasEcosystem(projectDir)) return null;
  try { const t = fs.readFileSync(path.join(ecoDir(projectDir), 'ECOSYSTEM.md'), 'utf8'); return `[agentic-os] Ecosystem map present:\n\n${t.slice(0, 2000)}`; } catch { return null; }
}
module.exports = { preEditContext, promptRouter, docsFirstReminder, postEditNudge, sessionSummary, newFileGap, summarizeAudit };
