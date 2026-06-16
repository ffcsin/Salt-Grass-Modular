// src/diagnostics/schema-fanout.js
// Schema fan-out: when a schema/model file is touched, find where its fields are used across the
// repo BEFORE the edit breaks them (an established pattern, generalized — works for Drizzle/Zod/Mongoose/
// Prisma/TS-interface/class shapes). extractFields is heuristic (colon-keyed identifiers + prisma
// field lines); fanout does a single O(files) pass tallying which fields each source file references.
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../../lib/walk');

const STOP = new Set(['if', 'for', 'while', 'return', 'function', 'const', 'let', 'var', 'import', 'export', 'type', 'interface', 'class', 'enum', 'default', 'public', 'private', 'protected', 'static', 'async', 'await', 'new', 'this', 'super', 'case', 'switch', 'try', 'catch', 'else', 'do', 'in', 'of', 'as', 'from']);

// Does this file look like a schema/model? (path or content signal)
function looksLikeSchema(file, content) {
  if (/\.(schema|model|entity|dto|table)\.[tj]sx?$/i.test(file) || /(^|\/)(schema|models?|entities|dtos)\//i.test(file)) return true;
  return /pgTable\(|mysqlTable\(|sqliteTable\(|mongoose\.Schema|new Schema\(|z\.object\(|@Entity\(|@Column\(|^model\s+\w+\s*\{/m.test(content || '');
}

// Extract candidate field names.
function extractFields(content) {
  const fields = new Set();
  const src = String(content || '');
  // colon-keyed members: `fieldName: ...` / `fieldName?: ...` (drizzle/zod/mongoose/TS/dto)
  for (const m of src.matchAll(/(?:^|[\s{,])([A-Za-z_$][\w$]*)\??\s*:/gm)) if (!STOP.has(m[1])) fields.add(m[1]);
  // prisma model lines: `  fieldName  Type` inside a `model X { ... }`
  const prisma = src.match(/model\s+\w+\s*\{([\s\S]*?)\}/g) || [];
  for (const block of prisma) for (const m of block.matchAll(/^\s*([A-Za-z_$][\w$]*)\s+[A-Za-z]/gm)) if (!STOP.has(m[1])) fields.add(m[1]);
  return [...fields];
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One pass over repo source: for each field, which files reference it (capped). Excludes the schema
// file itself. Very common identifiers naturally fan out widely — that's the signal, not noise.
function fanout(root, fields, excludeRel, opts = {}) {
  const cap = opts.cap || 12;
  const exts = opts.exts || ['.ts', '.tsx', '.js', '.jsx'];
  const result = Object.fromEntries(fields.map((f) => [f, { count: 0, files: [] }]));
  if (!fields.length) return result;
  const alt = new RegExp('\\b(' + fields.map(escapeRe).join('|') + ')\\b', 'g');
  let files = [];
  try { files = walk(root, { include: exts }); } catch { return result; }
  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    if (rel === excludeRel) continue;
    let content = '';
    try { content = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    const seen = new Set();
    let m;
    alt.lastIndex = 0;
    while ((m = alt.exec(content)) !== null) seen.add(m[1]);
    for (const f of seen) { const r = result[f]; r.count++; if (r.files.length < cap) r.files.push(rel); }
  }
  return result;
}

// Generic field names that fan out everywhere → noise, not signal. Pick the most SPECIFIC fields.
const GENERIC = new Set(['id', 'name', 'type', 'at', 'by', 'on', 'is', 'data', 'value', 'url', 'key', 'status', 'date', 'time', 'count', 'total', 'label', 'title', 'text', 'code', 'role', 'user', 'email', 'phone', 'address', 'createdAt', 'updatedAt', 'deletedAt']);
function specificFields(fields, max = 4) {
  return fields.filter((f) => f.length >= 5 && !GENERIC.has(f)).sort((a, b) => b.length - a.length).slice(0, max);
}

// Categorized blast radius (reference parity): bucket fanout hits by importance so the agent sees the
// LOAD-BEARING consumers first (audit/behavior docs > other schemas/DTOs > BE consumers > FE).
// Early-exits per field (cap hits) so it stays fast even on big repos.
function categorizeFanout(root, fields, excludeRel, opts = {}) {
  const cap = opts.capPerBucket || 8;
  const exts = ['.ts', '.tsx', '.js', '.jsx', '.md'];
  const buckets = { auditDocs: [], otherDocs: [], schemas: [], dtos: [], be: [], fe: [] };
  if (!fields.length) return buckets;
  const alt = new RegExp('\\b(' + fields.map(escapeRe).join('|') + ')\\b');
  // Scan INTO .ecosystem (so the generated audit docs are in the fanout) but still skip build dirs.
  const skip = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.vercel', '.turbo', '.astro', 'out', '.cache']);
  let files = []; try { files = walk(root, { include: exts, skip }); } catch { return buckets; }
  const bucketOf = (rel) => {
    if (/\.ecosystem\/audits\/|docs\/ecosystem\/tools\//.test(rel)) return 'auditDocs';
    if (/\.ecosystem\/areas\/|docs\/ecosystem\/behaviors\/|\.md$/.test(rel)) return 'otherDocs';
    if (/\.(schema|model|entity|table)\.[tj]s/.test(rel)) return 'schemas';
    if (/\.dto\.[tj]s/.test(rel)) return 'dtos';
    if (/(services|server|api|backend|src\/.*controller|src\/.*service)/.test(rel)) return 'be';
    return 'fe';
  };
  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    if (rel === excludeRel) continue;
    const b = bucketOf(rel); if (buckets[b].length >= cap) continue;
    let content = ''; try { content = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    const m = alt.exec(content); if (m) buckets[b].push({ file: rel, field: m[1] });
  }
  return buckets;
}

// Convenience: analyze one schema file → its fields + fanout.
function analyzeSchemaFile(root, relFile) {
  let content = '';
  try { content = fs.readFileSync(path.join(root, relFile), 'utf8'); } catch {}
  const fields = extractFields(content);
  return { file: relFile, isSchema: looksLikeSchema(relFile, content), fields, fanout: fanout(root, fields, relFile) };
}

module.exports = { looksLikeSchema, extractFields, fanout, analyzeSchemaFile, categorizeFanout, specificFields };
