'use strict';
// Split-stack gate planning — when a repo's toolchains live in COMPONENT dirs (backend/go.mod +
// frontend/package.json) rather than at the root, root-level planning produces junk: field testing
// generated `npm biome check .` at a root with no package.json (biome lives in frontend/, installed
// via pnpm). This planner walks each conventional component dir and emits steps with an explicit cwd,
// the component's OWN package manager (its lockfile, not the root's), and its OWN scripts — i.e. the
// commands the repo's developers actually run. Each step also carries `install` (CI needs it; the
// local pre-push doesn't reinstall) and `lang` (so CI renderers pick the right image per job).
const fs = require('node:fs');
const path = require('node:path');

const COMPONENT_DIRS = ['backend', 'frontend', 'server', 'client', 'web', 'api', 'mobile'];

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

// The component's own lockfile decides its package manager; fall back to the root-level detection.
function pmOf(dir, rootPm) {
  if (exists(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (exists(path.join(dir, 'yarn.lock'))) return 'yarn';
  if (exists(path.join(dir, 'bun.lock')) || exists(path.join(dir, 'bun.lockb'))) return 'bun';
  if (exists(path.join(dir, 'package-lock.json'))) return 'npm';
  return rootPm || 'npm';
}

const installFor = (pm) =>
  pm === 'pnpm' ? 'corepack enable && pnpm install --frozen-lockfile'
  : pm === 'yarn' ? 'corepack enable && yarn install --immutable'
  : pm === 'bun' ? 'bun install --frozen-lockfile'
  : 'npm ci || npm install';

// Pick a NON-WATCH test script. A bare `vitest`/`jest --watch` in a pre-push hook hangs forever
// waiting for a TTY (a pnpm frontend: test = "vitest", the run-once variant is test:run).
function testScriptName(scripts) {
  for (const n of ['test:ci', 'test:run', 'test:unit']) if (scripts[n]) return n;
  if (scripts.test && !/^\s*(vitest|jest\s+--watch.*)\s*$/.test(scripts.test)) return 'test';
  return null; // only a bare watch-mode runner → skip rather than hang the hook
}

// Conventional component dirs that declare their own toolchain → [{dir, kind, pm?, scripts?}].
function detectComponents(root, rootPm) {
  const comps = [];
  for (const d of COMPONENT_DIRS) {
    const abs = path.join(root, d);
    try { if (!fs.statSync(abs).isDirectory()) continue; } catch { continue; }
    if (exists(path.join(abs, 'go.mod'))) { comps.push({ dir: d, kind: 'go' }); continue; }
    const pkg = readJson(path.join(abs, 'package.json'));
    if (pkg) comps.push({ dir: d, kind: 'js', pm: pmOf(abs, rootPm), scripts: pkg.scripts || {} });
  }
  return comps;
}

// Plan per-component gate steps. Returns null when the repo has no component dirs (single-root repo →
// caller falls through to the root planner; zero behavior change for existing repos).
// step = { gate, name, command, cwd, lang, install? }
function planComponentGates(root, rootPm) {
  const comps = detectComponents(root, rootPm);
  if (!comps.length) return null;
  const steps = [];
  for (const c of comps) {
    if (c.kind === 'go') {
      // go vet/build/test auto-download modules — no install step needed.
      steps.push({ gate: 'lint', name: `vet-${c.dir}`, command: 'go vet ./...', cwd: c.dir, lang: 'go' });
      steps.push({ gate: 'build', name: `build-${c.dir}`, command: 'go build ./...', cwd: c.dir, lang: 'go' });
      steps.push({ gate: 'test', name: `test-${c.dir}`, command: 'go test ./...', cwd: c.dir, lang: 'go' });
      continue;
    }
    const s = c.scripts, pm = c.pm, install = installFor(pm);
    const run = (name) => `${pm} run ${name}`;
    const exec = (cmd) => (pm === 'npm' ? `npx --no-install ${cmd}` : pm === 'bun' ? `bunx ${cmd}` : `${pm} exec ${cmd}`);
    if (s.lint) steps.push({ gate: 'lint', name: `lint-${c.dir}`, command: run('lint'), cwd: c.dir, lang: 'js', install });
    const tc = s.typecheck ? 'typecheck' : s['type-check'] ? 'type-check' : null;
    if (tc) steps.push({ gate: 'typecheck', name: `typecheck-${c.dir}`, command: run(tc), cwd: c.dir, lang: 'js', install });
    else if (exists(path.join(root, c.dir, 'tsconfig.json'))) steps.push({ gate: 'typecheck', name: `typecheck-${c.dir}`, command: exec('tsc --noEmit'), cwd: c.dir, lang: 'js', install });
    const tn = testScriptName(s);
    if (tn) steps.push({ gate: 'test', name: `test-${c.dir}`, command: run(tn), cwd: c.dir, lang: 'js', install });
    if (s.build) steps.push({ gate: 'build', name: `build-${c.dir}`, command: run('build'), cwd: c.dir, lang: 'js', install });
    steps.push({ gate: 'dep-audit', name: `dep-audit-${c.dir}`, command: `${pm} audit --audit-level=high`, cwd: c.dir, lang: 'js', install });
  }
  return steps;
}

module.exports = { detectComponents, planComponentGates, pmOf, testScriptName, installFor, COMPONENT_DIRS };
