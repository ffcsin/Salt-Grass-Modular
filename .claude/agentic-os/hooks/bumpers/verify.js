const fs = require('node:fs');
const path = require('node:path');
const { hasEcosystem, loadPathToArea, areaForFile } = require('../lib/eco');
function rel(projectDir, filePath) { return path.relative(projectDir, filePath).replace(/\\/g, '/'); }
function blastRadius(cfg, filePath, projectDir) {
  if (!filePath) return null;
  const r = rel(projectDir, filePath);
  return (cfg.highFanoutFiles || []).includes(r)
    ? `[agentic-os] ${r} is high-fan-out (many routes/areas) — broad blast radius. Verify dependents before/after.` : null;
}
function newFileNudge(projectDir, filePath) {
  if (!filePath || fs.existsSync(filePath)) return null;
  return `[agentic-os] New file — if this starts a NEW feature, the mandated flow is spec-first: run superpowers:brainstorming to lock the design before building (2026 best practice: a 5-min spec prevents the 80%-done rebuild). After it lands, plan an intent doc + re-run bootstrap so it gets mapped.`;
}
function track(projectDir, fileName, value) {
  try {
    const f = path.join(projectDir, '.ecosystem', fileName);
    let arr = []; try { arr = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
    if (value && !arr.includes(value)) { arr.push(value); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(arr)); }
  } catch {}
  return null;
}
const trackRead = (projectDir, filePath) => {
  try { require('../../src/stale-context').recordRead(projectDir, filePath); } catch {}
  return track(projectDir, '.session-reads.json', filePath);
};
const trackEdit = (projectDir, filePath) => track(projectDir, '.session-edits.json', filePath);
// Mark a file dirty (repo-relative) for the next batched incremental deep-extract. FREE — 0 tokens.
const markDirty = (projectDir, filePath) => filePath ? track(projectDir, '.dirty.json', rel(projectDir, filePath)) : null;
function trackAudit(projectDir, who, filePath, action) {
  try {
    let area = '';
    try { const m = areaForFile(filePath, loadPathToArea(projectDir), projectDir); if (m && m.area) area = m.area; } catch {}
    const f = path.join(projectDir, '.ecosystem', 'audit-log.jsonl');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), who: who || 'unknown', file: filePath, area, action: action || 'edit' });
    fs.appendFileSync(f, line + '\n');
  } catch {}
  return null;
}
// TDD gate (ask-default) — the 2026 "spec/test-first" discipline, enforced not just reminded. Fires
// when CREATING a new source file that DEFINES exports/functions and has NO sibling test, so the agent
// is asked to write the failing test first. Deliberately narrow: only NEW non-test source with real
// exports — never on edits to existing code, configs, docs, types, or tests.
const SRC_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java)$/;
const TEST_RE = /(\.(test|spec)\.|_test\.|(^|\/)(tests?|__tests__|spec)\/)/;
const EXPORT_RE = /\b(export\s+(default\s+)?(function|class|const|async)|export\s*\{|module\.exports|def\s+\w+|func\s+[A-Z]\w*|pub\s+fn|public\s+(class|static))/;
function siblingTestExists(projectDir, filePath) {
  const p = require('node:path');
  const dir = p.dirname(filePath), ext = p.extname(filePath), base = p.basename(filePath).replace(SRC_RE, '');
  const cands = [
    p.join(dir, `${base}.test${ext}`), p.join(dir, `${base}.spec${ext}`), p.join(dir, `${base}_test${ext}`),
    p.join(dir, '__tests__', `${base}.test${ext}`), p.join(dir, '__tests__', `${base}${ext}`),
    p.join(projectDir, 'test', `${base}.test${ext}`), p.join(projectDir, 'tests', `${base}.test${ext}`),
  ];
  if (ext === '.go') cands.push(p.join(dir, `${base}_test.go`));
  for (const c of cands) { try { if (fs.statSync(c).isFile()) return true; } catch {} }
  return false;
}
function tddGate(projectDir, filePath, isNew, content) {
  try {
    const f = String(filePath || '');
    if (!isNew || !SRC_RE.test(f) || TEST_RE.test(f)) return { triggered: false };
    if (/\.d\.ts$|\b(config|setup|index|types?|constants?|migrations?)\b/i.test(f)) return { triggered: false };
    if (content && !EXPORT_RE.test(content)) return { triggered: false }; // no real exports → not test-worthy
    if (siblingTestExists(projectDir, f)) return { triggered: false };
    const rel = path.relative(projectDir, f).replace(/\\/g, '/');
    return { triggered: true, reason: `[agentic-os] Test-first (TDD): \`${rel}\` is new code with exports and no sibling test. Per the mandated superpowers:test-driven-development workflow, write the FAILING test first, watch it fail, then implement. (Bypass once: AGENTIC_OS_OVERRIDE=1; disable: hooks-config tddGate=false.)` };
  } catch { return { triggered: false }; }
}

function readBeforeEditGate(projectDir, filePath) {
  try {
    if (!hasEcosystem(projectDir) || !filePath) return { triggered: false };
    const m = areaForFile(filePath, loadPathToArea(projectDir), projectDir);
    if (!m || m.area === 'ungrouped' || m.area === 'root') return { triggered: false };
    let reads = [];
    try { reads = JSON.parse(fs.readFileSync(path.join(projectDir, '.ecosystem', '.session-reads.json'), 'utf8')); } catch {}
    const docPath = path.join(projectDir, '.ecosystem', 'areas', m.area + '.md');
    const engaged = reads.includes(filePath) || reads.includes(docPath) || reads.some((r) => r.replace(/\\/g, '/').endsWith(`/areas/${m.area}.md`));
    if (engaged) return { triggered: false };
    return { triggered: true, reason: `[agentic-os] Trust-but-verify: read .ecosystem/areas/${m.area}.md (or the file itself) before editing ${m.area} — then verify against code.` };
  } catch { return { triggered: false }; }
}
module.exports = { blastRadius, newFileNudge, trackRead, trackEdit, trackAudit, markDirty, readBeforeEditGate, tddGate, siblingTestExists };
