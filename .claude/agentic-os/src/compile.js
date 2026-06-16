// src/compile.js
const fs = require('node:fs');
const path = require('node:path');
const { validatePatternSet } = require('../lib/patternset');

const CONFIG_REL = path.join('.ecosystem', 'extractor.config.json');

function saveConfig(root, patternSet) {
  const res = validatePatternSet(patternSet);
  if (!res.ok) throw new Error('invalid PatternSet: ' + res.errors.join('; '));
  const full = path.join(root, CONFIG_REL);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(patternSet, null, 2) + '\n');
  return full;
}

function loadConfig(root) {
  const full = path.join(root, CONFIG_REL);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

// Regenerate a repo's persisted extractor config from the CURRENT default-patternset, preserving the
// detect-derived stack verbatim. Engine upgrades improve the default patterns (ext scoping, new
// typed-client shapes), but installed repos keep their bootstrap-era config forever — this closes
// that gap in one command (MLM field lesson: a stale unscoped express pattern double-extracted 9 gin
// routes until a manual regen). Safety: patterns whose regex isn't in the current default set are
// treated as agent-refined customizations — refuse (listing them) unless opts.force; on regen the
// old config is backed up to extractor.config.json.bak so recovery is one copy away.
function regenPatterns(root, opts = {}) {
  const cfg = loadConfig(root);
  if (!cfg) return { regenerated: false, reason: 'no-config' };
  const { defaultPatternSet } = require('./default-patternset');
  const ps = defaultPatternSet(cfg.stack || {});
  ps.stack = cfg.stack || ps.stack;
  // Customization detection covers EVERYTHING the regen would overwrite — regex patterns AND the
  // structural fields (fileRoutes baseDirs, fileGlobs). An agent-refined `apps/web/app` fileRoutes
  // entry is as load-bearing as a custom regex; dropping it silently would violate the refusal
  // contract. New-default ADDITIONS are fine (upgrades add probes); only cfg entries absent from
  // the new defaults count as custom.
  const defaults = new Set([...ps.feCallPatterns, ...ps.routePatterns, ...(ps.routePrefixPatterns || []), ...(ps.surfacePatterns || [])].map((p) => p.regex));
  const customPatterns = [...(cfg.feCallPatterns || []), ...(cfg.routePatterns || []), ...(cfg.routePrefixPatterns || []), ...(cfg.surfacePatterns || [])]
    .map((p) => p.regex).filter((r) => !defaults.has(r));
  const defaultFR = new Set((ps.fileRoutes || []).map((f) => JSON.stringify(f)));
  const customFileRoutes = (cfg.fileRoutes || []).map((f) => JSON.stringify(f)).filter((f) => !defaultFR.has(f));
  const defaultGlobs = new Set([...(ps.fileGlobs.frontend || []), ...(ps.fileGlobs.backend || [])]);
  const customGlobs = [...((cfg.fileGlobs || {}).frontend || []), ...((cfg.fileGlobs || {}).backend || [])].filter((g) => !defaultGlobs.has(g));
  const custom = [...customPatterns, ...customFileRoutes.map((f) => 'fileRoutes: ' + f), ...customGlobs.map((g) => 'fileGlobs: ' + g)];
  if (custom.length && !opts.force) {
    return { regenerated: false, reason: 'custom-patterns', customPatterns: custom };
  }
  const full = path.join(root, CONFIG_REL);
  // idempotence: re-running after a regen is a no-op — compare parsed JSON (disk may be CRLF-mangled)
  if (JSON.stringify(cfg) === JSON.stringify(ps)) return { regenerated: false, reason: 'already-current' };
  // never clobber an existing .bak: it holds the OLDEST pre-regen original (a second forced run
  // would otherwise overwrite the only copy of the dropped customizations)
  if (!fs.existsSync(full + '.bak')) fs.copyFileSync(full, full + '.bak');
  saveConfig(root, ps);
  return {
    regenerated: true,
    backup: full + '.bak',
    routePatterns: ps.routePatterns.length,
    feCallPatterns: ps.feCallPatterns.length,
    ...(custom.length ? { droppedCustom: custom } : {}),
  };
}

module.exports = { saveConfig, loadConfig, regenPatterns, CONFIG_REL };
