// src/detect-ci.js
// Detect the repo's CI platform(s) and which governance tools it already has wired. Pure data —
// presence checks only, no hardcoded stack assumptions. Consumed by the gate runners + CI generators.
const fs = require('node:fs');
const path = require('node:path');

const exists = (root, rel) => { try { fs.accessSync(path.join(root, rel)); return true; } catch { return false; } };
function readPkgAt(abs) { try { return JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return {}; } }

// One level of workspace dirs (apps/* services/* packages/*) + conventional top-level component dirs
// (backend/ frontend/ …) + root — so repos that declare their tooling per-component are still detected.
function workspaceDirs(root) {
  const dirs = ['.'];
  for (const base of ['apps', 'services', 'packages']) {
    let entries = [];
    try { entries = fs.readdirSync(path.join(root, base), { withFileTypes: true }); } catch { continue; }
    for (const e of entries) if (e.isDirectory()) dirs.push(`${base}/${e.name}`);
  }
  for (const dir of ['backend', 'frontend', 'server', 'client', 'web', 'api', 'mobile']) {
    try { if (fs.statSync(path.join(root, dir)).isDirectory()) dirs.push(dir); } catch { /* absent */ }
  }
  return dirs;
}
// Merge deps across root + all workspace package.json.
function collectDeps(root) {
  const deps = {};
  for (const d of workspaceDirs(root)) {
    const pkg = readPkgAt(path.join(root, d, 'package.json'));
    Object.assign(deps, pkg.dependencies || {}, pkg.devDependencies || {});
  }
  return deps;
}
// Does any of (root + workspace dirs) contain one of these config files?
function cfgAnywhere(root, names) {
  for (const d of workspaceDirs(root)) for (const n of names) if (exists(root, d === '.' ? n : `${d}/${n}`)) return true;
  return false;
}
function anyTestScript(root) {
  for (const d of workspaceDirs(root)) { const pkg = readPkgAt(path.join(root, d, 'package.json')); if (pkg.scripts && pkg.scripts.test) return true; }
  return false;
}

// Which CI platform configs are present.
function detectCI(root) {
  const found = [];
  // "Uses GitHub Actions" requires an actual workflow that ISN'T our own generated file — an empty
  // .github/workflows/ (or one holding only agentic-os-checks.yml) would make gen-ci re-create the
  // GitHub config forever on a GitLab-only repo (circular self-detection; caught in field testing).
  try {
    const wf = fs.readdirSync(path.join(root, '.github', 'workflows'));
    if (wf.some((f) => /\.ya?ml$/i.test(f) && !/^agentic-os-checks\.ya?ml$/i.test(f))) found.push('github');
  } catch { /* no workflows dir */ }
  if (exists(root, '.gitlab-ci.yml')) found.push('gitlab');
  if (exists(root, '.circleci/config.yml')) found.push('circleci');
  if (exists(root, 'bitbucket-pipelines.yml')) found.push('bitbucket');
  if (exists(root, 'azure-pipelines.yml')) found.push('azure');
  return found; // [] = none detected
}

// Which governance tools the repo can run (from declared deps + config files). Each entry is what
// the gate runner will look for; absence => that gate is SKIPPED, never failed.
function detectTooling(root) {
  const deps = collectDeps(root); // root + workspaces (monorepo-aware)
  const rootPkg = readPkgAt(path.join(root, 'package.json'));
  const has = (d) => Object.prototype.hasOwnProperty.call(deps, d);
  const cfg = (rels) => cfgAnywhere(root, rels);
  const isJs = has('typescript') || rootPkg.name || cfg(['tsconfig.json']);

  return {
    packageManager: exists(root, 'bun.lockb') || exists(root, 'bun.lock') ? 'bun'
      : exists(root, 'pnpm-lock.yaml') ? 'pnpm'
      : exists(root, 'yarn.lock') ? 'yarn'
      : exists(root, 'package-lock.json') ? 'npm'
      : isJs ? 'npm' : null,
    lint: has('@biomejs/biome') || cfg(['biome.json', 'biome.jsonc']) ? 'biome'
      : has('eslint') || cfg(['.eslintrc', '.eslintrc.json', '.eslintrc.js', 'eslint.config.js', 'eslint.config.mjs']) ? 'eslint'
      : has('ruff') || cfg(['ruff.toml', '.ruff.toml']) ? 'ruff'
      : null,
    typecheck: has('typescript') || cfg(['tsconfig.json']) ? 'tsc'
      : has('mypy') || cfg(['mypy.ini']) ? 'mypy'
      : null,
    test: (rootPkg.scripts && rootPkg.scripts.test) || anyTestScript(root) ? 'npm-script'
      : has('vitest') ? 'vitest'
      : has('jest') ? 'jest'
      : cfg(['pytest.ini', 'pyproject.toml', 'requirements.txt']) ? 'pytest'
      : null,
    sast: cfg(['.semgrep.yml', '.semgrep/']) ? 'semgrep' : null, // semgrep is a CLI; gate probes for it at runtime too
    secretScan: cfg(['.gitleaks.toml', '.gitleaksignore']) ? 'gitleaks' : 'builtin', // builtin regex fallback always available
    depAudit: isJs ? 'npm-or-osv'
      : cfg(['requirements.txt', 'pyproject.toml']) ? 'pip-audit'
      : null,
    commitlint: has('@commitlint/cli') || cfg(['commitlint.config.js', '.commitlintrc.json']) ? 'commitlint' : null,
  };
}

module.exports = { detectCI, detectTooling };
