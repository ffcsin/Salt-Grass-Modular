'use strict';
// Reference-catalog extractors — ported from the reference implementation's agent-built generators (which proved this is
// ~90% deterministic regex/string work). Each scans the repo and emits a catalog the way the reference implementation's
// docs/ecosystem/reference/* do: crons, webhooks, collections, env-vars, tier-gates, and rich FE
// surfaces (nav + buttons + fetches, not just bare fetch calls). Zero deps; stack-agnostic-ish
// (JS/TS-first, the dominant case). These close the gap vs the reference implementation's hand-built reference catalogs.
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../lib/walk');

const lineOf = (content, idx) => content.slice(0, idx).split('\n').length;
const rel = (root, f) => path.relative(root, f).replace(/\\/g, '/');
function srcFiles(root, exts) { try { return walk(root, { include: exts || ['.ts', '.js'] }).filter((f) => !/\.(test|spec)\.[tj]sx?$|\.d\.ts$/.test(f)); } catch { return []; } }

// ---- CRONS ----
const CRON_HUMAN = {
  EVERY_SECOND: '* * * * * *', EVERY_MINUTE: '*/1 * * * *', EVERY_5_MINUTES: '*/5 * * * *',
  EVERY_10_MINUTES: '*/10 * * * *', EVERY_30_MINUTES: '*/30 * * * *', EVERY_HOUR: '0 * * * *',
  EVERY_DAY_AT_MIDNIGHT: '0 0 * * *', EVERY_DAY_AT_NOON: '0 12 * * *', EVERY_WEEK: '0 0 * * 0',
};
function extractCrons(root) {
  const out = [];
  for (const f of srcFiles(root)) {
    let c = ''; try { c = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const lines = c.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // NestJS @Cron(...) | node-cron schedule('...') | bull repeat cron
      const m = lines[i].match(/@Cron\(([^)]+)\)/) || lines[i].match(/cron\.schedule\(\s*['"`]([^'"`]+)/) || lines[i].match(/repeat:\s*\{\s*cron:\s*['"`]([^'"`]+)/);
      if (!m) continue;
      let expr = m[1].trim().replace(/^['"`]|['"`]$/g, '');
      const ce = expr.match(/CronExpression\.(\w+)/); if (ce) expr = CRON_HUMAN[ce[1]] || ce[1];
      let method = '';
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) { const mm = lines[j].match(/(?:async\s+)?(\w+)\s*\(/); if (mm && !lines[j].trim().startsWith('@')) { method = mm[1]; break; } }
      out.push({ schedule: expr, method, file: rel(root, f), line: i + 1 });
    }
  }
  return out;
}

// ---- WEBHOOKS ----
function extractWebhooks(root) {
  const out = [];
  for (const f of srcFiles(root)) {
    let c = ''; try { c = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (!/webhook/i.test(c) && !/webhook/i.test(f)) continue;
    const re = /@(Post|Get|Put|All)\(\s*[`'"]([^`'"]*webhook[^`'"]*)[`'"]/gi;
    let m;
    while ((m = re.exec(c)) !== null) {
      const near = c.slice(m.index, m.index + 1200);
      const sigVerify = /verif|signature|svix|stripe-signature|x-hub-signature|hmac|constructEvent/i.test(near);
      out.push({ method: m[1].toUpperCase(), route: m[2], signatureVerified: sigVerify, file: rel(root, f), line: lineOf(c, m.index) });
    }
  }
  return out;
}

// ---- COLLECTIONS (Mongo) ----
function extractCollections(root) {
  const counts = new Map(); // name -> {reads, writes, files:Set}
  const READ = /\.(find|findOne|aggregate|countDocuments|distinct)\s*\(/;
  const WRITE = /\.(insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany|replaceOne|bulkWrite|findOneAndUpdate|findOneAndDelete)\s*\(/;
  const collRe = /(?:\.collection\(\s*['"`]([a-zA-Z0-9_]+)['"`]\)|db\.([a-zA-Z0-9_]+)\.(?:find|insert|update|delete|aggregate|count)|getCollection\(\s*['"`]([a-zA-Z0-9_]+)['"`]\))/g;
  for (const f of srcFiles(root)) {
    let c = ''; try { c = fs.readFileSync(f, 'utf8'); } catch { continue; }
    let m;
    while ((m = collRe.exec(c)) !== null) {
      const name = m[1] || m[2] || m[3]; if (!name) continue;
      const rec = counts.get(name) || { reads: 0, writes: 0, files: new Set() };
      // Only the immediate operation after this collection ref (don't bleed into the next statement).
      const ctx = c.slice(m.index, m.index + m[0].length + 24);
      if (WRITE.test(ctx)) rec.writes++; else if (READ.test(ctx)) rec.reads++;
      rec.files.add(rel(root, f));
      counts.set(name, rec);
    }
  }
  return [...counts.entries()].map(([name, r]) => ({ name, reads: r.reads, writes: r.writes, files: [...r.files].slice(0, 12) })).sort((a, b) => (b.reads + b.writes) - (a.reads + a.writes));
}

// ---- ENV VARS ----
function extractEnvVars(root) {
  const map = new Map(); // name -> {reads, files:Set}
  const re = /process\.env\.([A-Z0-9_]+)|process\.env\[\s*['"]([A-Z0-9_]+)['"]\s*\]|import\.meta\.env\.([A-Z0-9_]+)/g;
  for (const f of srcFiles(root, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])) {
    let c = ''; try { c = fs.readFileSync(f, 'utf8'); } catch { continue; }
    let m;
    while ((m = re.exec(c)) !== null) { const name = m[1] || m[2] || m[3]; if (!name) continue; const rec = map.get(name) || { reads: 0, files: new Set() }; rec.reads++; rec.files.add(rel(root, f)); map.set(name, rec); }
  }
  return [...map.entries()].map(([name, r]) => ({ name, reads: r.reads, files: [...r.files].slice(0, 8) })).sort((a, b) => b.reads - a.reads);
}

// ---- TIER / FEATURE GATES ----
const GATE_PATTERNS = [
  { kind: 'RequiresProduct', re: /@RequiresProduct\(\s*\[?\s*['"]([^'"]+)['"]/g, grp: 'feature' },
  { kind: 'requiresProduct', re: /requiresProduct:\s*['"]([^'"]+)['"]/g, grp: 'feature' },
  { kind: 'requiresAnyProduct', re: /requiresAnyProduct:\s*\[\s*['"]([^'"]+)['"]/g, grp: 'feature' },
  { kind: 'hasMinTier', re: /(?:hasMinTier|meetsMinTier|requireTier)\(\s*[^,]*,?\s*['"]([a-z-]+)['"]/g, grp: 'tier' },
  { kind: 'TierGate', re: /<TierGate[^>]*(?:requires|tier)=["']([^"']+)["']/g, grp: 'tier' },
  { kind: 'FeatureGate', re: /<FeatureGate[^>]*feature=["']([^"']+)["']/g, grp: 'feature' },
  { kind: 'tierEquals', re: /(?:plan|tier)\s*===\s*['"]([a-z-]+)['"]/g, grp: 'tier' },
  { kind: 'hasFeature', re: /hasFeature\(\s*['"]([^'"]+)['"]/g, grp: 'feature' },
];
function extractGates(root) {
  const out = [];
  for (const f of srcFiles(root, ['.ts', '.tsx', '.js', '.jsx'])) {
    let c = ''; try { c = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const p of GATE_PATTERNS) { p.re.lastIndex = 0; let m; while ((m = p.re.exec(c)) !== null) out.push({ kind: p.kind, value: m[1], grp: p.grp, file: rel(root, f), line: lineOf(c, m.index) }); }
  }
  return out;
}

// ---- RICH FE SURFACES (buttons + fetches) ----
function extractFeSurfaces(root) {
  const surfaces = [];
  for (const f of srcFiles(root, ['.tsx', '.jsx'])) {
    let c = ''; try { c = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const buttons = []; const fetches = [];
    let m;
    const btnRe = /on(Click|Submit)\s*=\s*\{([^}]{1,120})\}/g;
    while ((m = btnRe.exec(c)) !== null) { const after = c.slice(m.index + m[0].length, m.index + m[0].length + 600); const lbl = after.match(/>\s*([^<{][^<{]{0,59})</); buttons.push({ kind: m[1].toLowerCase(), handler: m[2].trim().slice(0, 60), label: lbl ? lbl[1].trim() : null, line: lineOf(c, m.index) }); }
    const fetchRe = /(?:authFetch|apiFetch|fetch)\(\s*[`'"]([^`'"]+)|axios\.(?:get|post|put|delete|patch)\(\s*[`'"]([^`'"]+)/g;
    while ((m = fetchRe.exec(c)) !== null) { const url = m[1] || m[2]; const mm = c.slice(m.index, m.index + 300).match(/method:\s*['"]([A-Z]+)/); fetches.push({ url, method: mm ? mm[1] : 'GET', line: lineOf(c, m.index) }); }
    if (buttons.length || fetches.length) surfaces.push({ file: rel(root, f), buttons: buttons.slice(0, 30), fetches: fetches.slice(0, 30) });
  }
  return surfaces;
}

function buildCatalogs(root) {
  return { crons: extractCrons(root), webhooks: extractWebhooks(root), collections: extractCollections(root), envVars: extractEnvVars(root), gates: extractGates(root), feSurfaces: extractFeSurfaces(root) };
}

module.exports = { extractCrons, extractWebhooks, extractCollections, extractEnvVars, extractGates, extractFeSurfaces, buildCatalogs };
