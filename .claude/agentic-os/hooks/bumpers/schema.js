// hooks/bumpers/schema.js
// PreToolUse: when editing a schema/model/DTO, run the categorized field fan-out INLINE (capped +
// early-exit so it's fast) and surface the blast radius — load-bearing consumers first (audit/
// behavior docs > schemas > DTOs > BE > FE), like the reference implementation's schema-fanout-detector. The agent sees
// what a field rename breaks BEFORE shipping a half-rename.
const fs = require('node:fs');
const path = require('node:path');
const { looksLikeSchema, extractFields, specificFields, categorizeFanout } = require('../../src/diagnostics/schema-fanout');

function schemaFanoutNudge(projectDir, filePath) {
  if (!filePath) return '';
  let content = '';
  try { content = fs.readFileSync(path.isAbsolute(filePath) ? filePath : path.join(projectDir, filePath), 'utf8'); } catch { return ''; }
  const rel = path.isAbsolute(filePath) ? path.relative(projectDir, filePath).replace(/\\/g, '/') : filePath;
  if (!looksLikeSchema(rel, content)) return '';
  const fields = specificFields(extractFields(content));
  if (!fields.length) return '';
  let b; try { b = categorizeFanout(projectDir, fields, rel); } catch { b = null; }
  const lines = [`🧬 SCHEMA FAN-OUT — editing \`${rel}\`. Blast radius for field(s): ${fields.map((f) => '`' + f + '`').join(', ')}`];
  const sec = (title, hits, icon) => { if (hits && hits.length) lines.push(`${icon} ${title} (${hits.length}${hits.length >= 8 ? '+' : ''}):`, ...hits.map((h) => `  - \`${h.file}\` (${h.field})`)); };
  if (b) {
    sec('Audit docs that mention these fields — UPDATE them too', b.auditDocs, '🚨');
    sec('Behavior/area docs', b.otherDocs, '🚨');
    sec('Other schemas/models', b.schemas, '⚠️');
    sec('DTOs', b.dtos, '⚠️');
    sec('Backend consumers', b.be, '📝');
    sec('Frontend consumers', b.fe, '📝');
    if (![b.auditDocs, b.otherDocs, b.schemas, b.dtos, b.be, b.fe].some((x) => x.length)) lines.push('  (no downstream usages found — safe to change)');
  }
  lines.push(`Full report: \`node "\${CLAUDE_PLUGIN_ROOT}/bin/diagnose-schema.js" "${rel}"\``);
  return lines.join('\n');
}

module.exports = { schemaFanoutNudge };
