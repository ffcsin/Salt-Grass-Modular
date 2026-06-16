'use strict';
// CI self-maintenance — makes the CI/checks layer GROW WITH THE REPO automatically, the same way the
// ecosystem map self-updates: a PostToolUse hook marks "CI dirty" when a tooling/CI file changes, and
// preflight (or a Stop nudge) regenerates + RE-TESTS the configs. No manual gen-ci/ci-sync re-runs.
//   isCiRelevant   — is this edited file one that should re-trigger CI generation?
//   mark/read/clearCiDirty — the dirty marker (.ecosystem/.ci-dirty), mirrors the map's .dirty.json
//   verifyGates    — TEST the gates before trusting them: fast static probe, or a real run via gates.js
//   refreshCI      — regenerate GH+GL CI + import/critique existing + clear dirty (the self-heal step)
//   augmentSnippets— for holes in existing CI, emit merge-ready GH/GL steps to make it MORE ROBUST
//   ciDirtyNudge   — Stop reminder when CI files changed but weren't refreshed
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// ── what counts as a CI/tooling change ────────────────────────────────────
const CI_RELEVANT = [
  /(^|\/)package\.json$/,
  /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/,
  /(^|\/)\.gitlab-ci\.yml$/,
  /(^|\/)\.circleci\/config\.yml$/,
  /(^|\/)(bitbucket-pipelines|azure-pipelines)\.yml$/,
  /(^|\/)(\.eslintrc|eslint\.config)/,
  /(^|\/)biome\.jsonc?$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)(ruff|mypy|pytest)\.(toml|ini|cfg)$/,
  /(^|\/)pyproject\.toml$/,
  /(^|\/)requirements[^/]*\.txt$/,
  /(^|\/)(jest|vitest)\.config\.[cm]?[jt]s$/,
  /(^|\/)\.gitleaks\.toml$/,
  /(^|\/)\.semgrep/,
];
function isCiRelevant(rel) {
  const r = String(rel || '').replace(/\\/g, '/');
  if (!r || /(^|\/)(node_modules|dist|build|\.next|coverage)\//.test(r)) return false;
  // an agentic-os-generated config changing should NOT re-trigger (avoid self-loop)
  if (/agentic-os-checks\.ya?ml$|gitlab-ci\.agentic-os\.ya?ml$/.test(r)) return false;
  return CI_RELEVANT.some((re) => re.test(r));
}

// ── dirty marker (mirrors the map's .dirty.json) ──────────────────────────
const DIRTY = (root) => path.join(root, '.ecosystem', '.ci-dirty');
function readCiDirty(root) { try { const a = JSON.parse(fs.readFileSync(DIRTY(root), 'utf8')); return Array.isArray(a) ? a : []; } catch { return []; } }
function writeCiDirty(root, arr) { try { fs.mkdirSync(path.dirname(DIRTY(root)), { recursive: true }); fs.writeFileSync(DIRTY(root), JSON.stringify(arr)); } catch {} }
function clearCiDirty(root) { try { fs.rmSync(DIRTY(root), { force: true }); } catch {} }
function markCiDirty(root, fileOrRel) {
  if (!fileOrRel) return false;
  const rel = (path.isAbsolute(fileOrRel) ? path.relative(root, fileOrRel) : fileOrRel).replace(/\\/g, '/');
  if (!isCiRelevant(rel)) return false;
  const cur = readCiDirty(root);
  if (!cur.includes(rel)) { cur.push(rel); writeCiDirty(root, cur); }
  return true;
}

// ── gate verification ("test them first") ─────────────────────────────────
function binExists(root, bin) {
  const exts = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : [''];
  for (const e of exts) { try { fs.accessSync(path.join(root, 'node_modules', '.bin', bin + e)); return true; } catch {} }
  for (const d of (process.env.PATH || '').split(path.delimiter)) for (const e of exts) { try { fs.accessSync(path.join(d, bin + e)); return true; } catch {} }
  return false;
}
function probeGate(root, step, scripts) {
  if (step.builtin) return { gate: step.gate, status: 'ready' };           // builtin secret-scan
  if (step.skip) return { gate: step.gate, status: 'skipped', reason: step.skip };
  const cmd = step.command || '';
  let m;
  if ((m = cmd.match(/^(?:npm|yarn|pnpm|bun)\s+run\s+(\S+)/))) return { gate: step.gate, status: scripts[m[1]] ? 'ready' : 'no-script', command: cmd };
  if (/^(?:npm|yarn|pnpm|bun)\s+audit\b/.test(cmd)) return { gate: step.gate, status: 'ready', command: cmd };
  if ((m = cmd.match(/npx\s+(?:--no-install\s+)?(\S+)/))) return { gate: step.gate, status: binExists(root, m[1]) ? 'ready' : 'tool-missing', command: cmd };
  const first = cmd.trim().split(/\s+/)[0];
  return { gate: step.gate, status: binExists(root, first) ? 'ready' : 'tool-missing', command: cmd };
}
// probe (fast, static) by default; { run:true } actually executes the gate pack via gates.js.
function verifyGates(root, { run = false } = {}) {
  const detect = require('./detect').detect(root);
  let scripts = {}; try { scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts || {}; } catch {}
  if (run) { const { runGates } = require('./gates'); return runGates(root, detect, scripts).results.map((r) => ({ gate: r.gate, status: r.status, command: r.command })); }
  const { planGates } = require('./gates');
  return planGates(detect, scripts).map((s) => probeGate(root, s, scripts));
}

// ── augment existing CI (fill holes → more robust) ────────────────────────
function augmentSnippets(root) {
  const { critiqueCI } = require('./ci-import');
  const { planGates } = require('./gates');
  const detect = require('./detect').detect(root);
  let scripts = {}; try { scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts || {}; } catch {}
  const plan = planGates(detect, scripts);
  const cmdFor = (g) => { const s = plan.find((p) => p.gate === g && p.command); return s && s.command; };
  const missing = critiqueCI(root).missing.filter((g) => g === 'secret-scan' || cmdFor(g));
  const github = missing.map((g) => g === 'secret-scan'
    ? '      - name: secret-scan\n        run: bash .ecosystem/ci-check.sh   # builtin secret scan'
    : `      - name: ${g}\n        run: ${cmdFor(g)}`).join('\n');
  const gitlab = missing.map((g) => g === 'secret-scan'
    ? '    - bash .ecosystem/ci-check.sh   # builtin secret scan'
    : `    - ${cmdFor(g)}`).join('\n');
  return { gates: missing, github, gitlab };
}

// ── refresh (the self-heal step preflight/Stop calls) ─────────────────────
function refreshCI(root, { both = true } = {}) {
  const bin = (n, args = []) => { try { return execFileSync('node', [path.join(__dirname, '..', 'bin', n), root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return (e.stdout || '') + ''; } };
  const last = (s) => { try { return JSON.parse(String(s).trim().split('\n').pop()); } catch { return {}; } };
  const gen = last(bin('gen-ci.js', both ? ['--both'] : []));
  const sync = last(bin('ci-sync.js'));
  clearCiDirty(root);
  return { gen, sync };
}

function ciDirtyNudge(root) {
  const d = readCiDirty(root);
  if (!d.length) return null;
  return `[agentic-os] ${d.length} CI/tooling file(s) changed this session (${d.slice(0, 5).join(', ')}${d.length > 5 ? ', …' : ''}) — run /agentic-os:preflight to regenerate + re-test the CI configs (GH+GL + the local mirror), or \`node <plugin>/bin/ci-refresh.js .\`.`;
}

module.exports = { isCiRelevant, markCiDirty, readCiDirty, clearCiDirty, verifyGates, augmentSnippets, refreshCI, ciDirtyNudge };
