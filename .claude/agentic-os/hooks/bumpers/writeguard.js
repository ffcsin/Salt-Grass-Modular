'use strict';
// Write-time guards (PreToolUse on Edit/Write): scan the content the agent is about to write.
//  - SECRETS: provider regex + entropy → BLOCK (a credential should never hit disk).
//  - PHANTOM DEPS: a newly-imported bare package not in package.json → WARN (slopsquat surface).
// Both are cheap (no repo walk): secrets regex the new string; dep check reads package.json once.
// The expensive internal-phantom-call scan (needs the symbol index) lives in the preflight bin, not here.
const fs = require('node:fs');
const path = require('node:path');

function newContentOf(tool, ti) {
  if (tool === 'Write') return ti.content || '';
  if (tool === 'Edit') return [ti.new_string, ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e.new_string) : [])].filter(Boolean).join('\n');
  return '';
}

function secretBlock(projectDir, content) {
  try {
    const { scanSecrets, loadBaseline } = require('../../src/diagnostics/secret-scan');
    const hits = scanSecrets(content, { baseline: loadBaseline(projectDir) });
    if (!hits.length) return null;
    const top = hits.slice(0, 4).map((h) => `${h.desc} (\`${h.match}\`)`).join(', ');
    return `[agentic-os] Secret-write blocked: this edit contains ${hits.length} credential-looking value(s) — ${top}. Use an env var / secret store. (Override: AGENTIC_OS_OVERRIDE=1, or baseline the fingerprint in .ecosystem/secrets-baseline.json.)`;
  } catch { return null; }
}

function depWarn(projectDir, content) {
  try {
    const { NODE_BUILTINS } = require('../../src/diagnostics/phantom-api');
    const deps = new Set();
    try { const pj = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
      for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) Object.keys(pj[k] || {}).forEach((d) => deps.add(d)); } catch {}
    const found = new Set();
    const re = /(?:import\s+[^'"`;]*from\s*|require\(\s*|import\(\s*|import\s*)['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      let spec = m[1];
      if (/^[./~]/.test(spec) || spec.startsWith('@/') || spec.startsWith('node:')) continue;
      if (spec.includes('${')) continue; // template-variable path (e.g. ${CLAUDE_PLUGIN_ROOT}/…), not a package
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (NODE_BUILTINS.has(pkg) || deps.has(pkg)) continue;
      found.add(pkg);
    }
    if (!found.size) return null;
    return `[agentic-os] New dependency import(s) not in package.json: ${[...found].map((p) => '`' + p + '`').join(', ')} — verify each exists on the registry (slopsquat risk) and add it deliberately.`;
  } catch { return null; }
}

module.exports = { newContentOf, secretBlock, depWarn };
