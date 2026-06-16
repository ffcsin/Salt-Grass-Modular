// src/docgen.js
const fs = require('node:fs');
const path = require('node:path');
const { group } = require('./group');
const { renderArea } = require('./render-area');
const { renderIndex, buildClaudeBlock } = require('./render-index');
const { pathMap } = require('./path-map');
const { mergeClaudeMd } = require('./claudemd');
const { writeMachine, writeHumanIfMissing } = require('./merge');

const INTENT_SEED = (area) =>
  `# ${area} — intent\n\n<!-- agentic-os:intent-empty -->\n\n_What this area does, why it exists, and gotchas. ` +
  `Human-owned: agentic-os will never overwrite this file once you edit it._\n`;

function runDocgen(root) {
  const mapPath = path.join(root, '.ecosystem', 'map.json');
  if (!fs.existsSync(mapPath)) throw new Error('no .ecosystem/map.json — run the Mapping Engine first');
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

  const g = group(map);

  for (const name of g.order) {
    // defense-in-depth: area names should already be clean slugs (group.js areaOf), but a filename
    // must never contain Windows-invalid chars — sanitize at the write boundary too.
    const safe = name.replace(/[^a-zA-Z0-9._-]/g, '-');
    writeMachine(root, `areas/${safe}.md`, renderArea(g.areas[name]));
    writeHumanIfMissing(root, `intent/${safe}.md`, INTENT_SEED(name));
  }
  writeMachine(root, 'ECOSYSTEM.md', renderIndex(g));
  writeMachine(root, 'path-to-area.json', JSON.stringify(pathMap(map), null, 2) + '\n');

  const block = buildClaudeBlock(g);
  // CLAUDE.md (Claude-specific) + AGENTS.md (the cross-tool standard read by Cursor/Codex/Copilot/
  // Gemini/etc). Both get the same sentinel-merged mandate block, so the agent context is portable.
  for (const name of ['CLAUDE.md', 'AGENTS.md']) {
    const p = path.join(root, name);
    const existing = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    fs.writeFileSync(p, mergeClaudeMd(existing, block));
  }

  return { areas: g.order };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.');
  try {
    const { areas } = runDocgen(root);
    console.log(`Docs generated for ${areas.length} areas in ${path.join(root, '.ecosystem')}`);
  } catch (e) {
    console.error('docgen failed:', e.message);
    process.exit(1);
  }
}

module.exports = { runDocgen, INTENT_SEED };
