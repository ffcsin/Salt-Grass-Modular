'use strict';
// Audit enrichment — the AGENT-DRIVEN 90%. The deterministic bootstrap scaffolds each audit and
// marks the semantic sections (Intent / Intended Behavior / Gap Analysis / Tech Debt) agent-needed.
// This module: finds audits needing enrichment, builds a tight per-area BRIEF an agent uses to write
// those sections from the code, and applies a returned section back into the audit (keeping the
// deterministic sections intact). One agent fills one audit — that's how the reference implementation's depth was produced.
const fs = require('node:fs');
const path = require('node:path');

const MARKER = '<!-- agentic-os:agent-needed -->';
const AGENT_SECTIONS = ['Intent', 'Intended Behavior', 'Gap Analysis', 'Tech Debt'];

function auditsDir(root) { return path.join(root, '.ecosystem', 'audits'); }

function needsEnrich(md) { return String(md || '').includes(MARKER); }

function areasNeedingEnrich(root) {
  const dir = auditsDir(root);
  let files = []; try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')); } catch { return []; }
  const out = [];
  for (const f of files) { let md = ''; try { md = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; } if (needsEnrich(md)) out.push({ area: f.replace(/\.md$/, ''), path: path.join(dir, f), unfilled: AGENT_SECTIONS.filter((s) => sectionHasMarker(md, s)) }); }
  return out;
}

// Section body between its "## Name" header and the next "## " header.
function sectionRange(md, name) {
  const re = new RegExp(`^##+ ${name.replace(/[()]/g, '.')}.*$`, 'm');
  const m = re.exec(md); if (!m) return null;
  const start = m.index + m[0].length;
  const rest = md.slice(start); const nx = rest.search(/\n##+ /);
  return { headerEnd: start, bodyStart: start, bodyEnd: nx === -1 ? md.length : start + nx };
}
function sectionBody(md, name) { const r = sectionRange(md, name); return r ? md.slice(r.bodyStart, r.bodyEnd) : null; }
function sectionHasMarker(md, name) { const b = sectionBody(md, name); return b != null && b.includes(MARKER); }

// Replace a section's body with new prose (drops the agent-needed marker). Idempotent-ish: only
// replaces if the section exists. Returns the new markdown.
function applySection(md, name, newBody) {
  const r = sectionRange(md, name); if (!r) return md;
  const clean = String(newBody || '').trim();
  return md.slice(0, r.bodyStart) + '\n\n' + clean + '\n\n' + md.slice(r.bodyEnd).replace(/^\n+/, '');
}

// Apply several sections at once. sections = { Intent: '...', 'Tech Debt': '...' }
function applyEnrichment(root, area, sections) {
  const p = path.join(auditsDir(root), area + '.md');
  let md = fs.readFileSync(p, 'utf8');
  for (const [name, body] of Object.entries(sections || {})) if (body && AGENT_SECTIONS.includes(name)) md = applySection(md, name, body);
  fs.writeFileSync(p, md);
  return { path: p, remaining: AGENT_SECTIONS.filter((s) => sectionHasMarker(md, s)) };
}

// PRESERVE enrichment across regeneration — the "additive, never clobber" core. When gen-audits
// rebuilds an audit's deterministic skeleton (fresh routes/guards/recently-fixed), copy the
// agent-FILLED semantic sections from the OLD audit into the new one, so re-running never wipes the
// agent's prose. Deterministic sections get fresh data; Intent/Behavior/Gap/TechDebt keep their depth.
function preserveEnriched(newMd, oldMd) {
  if (!oldMd) return newMd;
  let out = newMd;
  for (const name of AGENT_SECTIONS) {
    const oldBody = sectionBody(oldMd, name);
    if (oldBody == null || oldBody.includes(MARKER)) continue; // old wasn't filled → leave new stub
    if (oldBody.trim().length < 12) continue;                  // ignore empty/old stub bodies
    out = applySection(out, name, oldBody.trim());             // carry the enriched prose forward
  }
  return out;
}

// Tight brief for the enriching agent, built from the area object (group()) + guards index. Gives
// the agent the route/guard/param table + the key source files so it can read them and write the
// 4 semantic sections without re-discovering structure.
function briefForArea(area, guardsByRoute) {
  const enrich = (r) => guardsByRoute && (guardsByRoute.get(`${r.method} ${r.route}`) || guardsByRoute.get(r.route)) || null;
  const files = [...new Set(area.routes.map((r) => r.file).concat(area.feCalls.map((w) => w.from && w.from.file)).filter(Boolean))].slice(0, 12);
  const routes = area.routes.slice(0, 40).map((r) => { const e = enrich(r); return `${r.method} ${r.route} [${e && e.guards && e.guards.length ? e.guards.join(',') : 'NO-AUTH'}]`; });
  const noAuth = area.routes.filter((r) => { const e = enrich(r); return e && (!e.guards || !e.guards.length); }).length;
  return {
    area: area.area,
    keyFiles: files,
    routeCount: area.routes.length, feCallCount: area.feCalls.length, noAuth,
    orphans: area.orphans.routesNoCaller.length,
    routesPreview: routes,
  };
}

module.exports = { MARKER, AGENT_SECTIONS, needsEnrich, areasNeedingEnrich, sectionBody, sectionHasMarker, applySection, applyEnrichment, briefForArea, preserveEnriched };
