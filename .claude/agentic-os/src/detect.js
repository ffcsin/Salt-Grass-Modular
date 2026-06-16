// src/detect.js
const fs = require('node:fs');
const path = require('node:path');
const { detectCI, detectTooling } = require('./detect-ci');

// Declared-dependency -> framework name. Extend freely; this is data, not hardcoded logic.
const JS_FRAMEWORKS = {
  express: 'express', fastify: 'fastify', '@nestjs/core': 'nestjs', next: 'nextjs',
  react: 'react', vue: 'vue', svelte: 'svelte', '@angular/core': 'angular', koa: 'koa',
};
const PY_FRAMEWORKS = [
  [/\bfastapi\b/i, 'fastapi'], [/\bdjango\b/i, 'django'], [/\bflask\b/i, 'flask'],
];
const RB_FRAMEWORKS = [
  [/\brails\b|railties/i, 'rails'], [/\bsinatra\b/i, 'sinatra'], [/\bhanami\b/i, 'hanami'],
];
// Presence of any of these = the repo is a DEPLOYED app (not a library), and tells design-gates which
// host build to mirror as the block gate. (detectGaps #5 from the gate-playbook research.)
const DEPLOY_MANIFESTS = ['Dockerfile', 'vercel.json', 'railway.json', 'railway.toml', 'fly.toml', 'netlify.toml', 'wrangler.toml', 'Procfile', 'render.yaml', 'app.yaml', 'kamal.yml', 'config/deploy.yml'];

function read(root, rel) {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return null; }
}

function addJsFrameworks(pkgRaw, frameworks) {
  let pkg = {};
  try { pkg = JSON.parse(pkgRaw); } catch { return; } // malformed manifest -> still JS, no frameworks
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  for (const dep of Object.keys(deps)) if (JS_FRAMEWORKS[dep]) frameworks.add(JS_FRAMEWORKS[dep]);
}

// Monorepos declare frameworks in per-workspace package.json, not the root. Scan one level
// under apps/ services/ packages/ so we don't miss nestjs/react/etc.
function scanWorkspaceManifests(root, languages, frameworks, manifests) {
  for (const base of ['apps', 'services', 'packages']) {
    let entries = [];
    try { entries = fs.readdirSync(path.join(root, base), { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const rel = `${base}/${e.name}/package.json`;
      const raw = read(root, rel);
      if (raw) { languages.add('javascript'); addJsFrameworks(raw, frameworks); manifests.push(rel); }
    }
  }
}

// Conventional TOP-LEVEL component dirs (backend/ + frontend/ etc — NOT the apps/*-style monorepo
// shape). Real-world gap: a Go backend at backend/go.mod + a Next app at frontend/package.json was
// invisible to root-only manifest reads (field testing on a Go/Next monorepo), yielding frameworks:[] and an empty
// map. Scan each dir's own manifests for every language we know.
const TOP_COMPONENT_DIRS = ['backend', 'frontend', 'server', 'client', 'web', 'api', 'mobile'];
function scanTopComponentDirs(root, languages, frameworks, manifests) {
  for (const dir of TOP_COMPONENT_DIRS) {
    const pkgRaw = read(root, `${dir}/package.json`);
    if (pkgRaw) { languages.add('javascript'); addJsFrameworks(pkgRaw, frameworks); manifests.push(`${dir}/package.json`); }
    if (read(root, `${dir}/go.mod`)) { languages.add('go'); manifests.push(`${dir}/go.mod`); }
    if (read(root, `${dir}/Cargo.toml`)) { languages.add('rust'); manifests.push(`${dir}/Cargo.toml`); }
    const pyRaw = read(root, `${dir}/requirements.txt`) || read(root, `${dir}/pyproject.toml`);
    if (pyRaw) { languages.add('python'); manifests.push(read(root, `${dir}/requirements.txt`) ? `${dir}/requirements.txt` : `${dir}/pyproject.toml`); for (const [re, name] of PY_FRAMEWORKS) if (re.test(pyRaw)) frameworks.add(name); }
    const gemRaw = read(root, `${dir}/Gemfile`);
    if (gemRaw) { languages.add('ruby'); manifests.push(`${dir}/Gemfile`); for (const [re, name] of RB_FRAMEWORKS) if (re.test(gemRaw)) frameworks.add(name); }
  }
}

function detect(root) {
  const languages = new Set();
  const frameworks = new Set();
  const manifests = [];

  const pkgRaw = read(root, 'package.json');
  if (pkgRaw) {
    manifests.push('package.json');
    languages.add('javascript');
    addJsFrameworks(pkgRaw, frameworks);
  }

  // Monorepo: also read workspace manifests (apps/* services/* packages/*).
  scanWorkspaceManifests(root, languages, frameworks, manifests);
  // Conventional top-level component dirs (backend/ frontend/ server/ client/ …).
  scanTopComponentDirs(root, languages, frameworks, manifests);

  const reqRaw = read(root, 'requirements.txt') || read(root, 'pyproject.toml');
  if (reqRaw) {
    manifests.push(read(root, 'requirements.txt') ? 'requirements.txt' : 'pyproject.toml');
    languages.add('python');
    for (const [re, name] of PY_FRAMEWORKS) if (re.test(reqRaw)) frameworks.add(name);
  }

  if (read(root, 'go.mod')) { manifests.push('go.mod'); languages.add('go'); }
  if (read(root, 'Cargo.toml')) { manifests.push('Cargo.toml'); languages.add('rust'); }
  const gem = read(root, 'Gemfile');
  if (gem) { manifests.push('Gemfile'); languages.add('ruby'); const blob = gem + (read(root, 'Gemfile.lock') || ''); for (const [re, name] of RB_FRAMEWORKS) if (re.test(blob)) frameworks.add(name); }

  // Deploy targets, static-site, and library-vs-app classification (gate-playbook detectGaps #3-5) — the
  // load-bearing inputs for archetype routing. Additive fields; existing consumers ignore them.
  const deployTargets = DEPLOY_MANIFESTS.filter((f) => read(root, f) != null);
  const allDeps = collectAllDeps(root);
  const services = detectServices(root, allDeps); // datastores the test suite needs (CI services:)
  const staticSite = !!(allDeps.has('astro') || read(root, 'astro.config.mjs') || read(root, 'astro.config.ts') || read(root, 'astro.config.js')
    || allDeps.has('@11ty/eleventy') || read(root, 'eleventy.config.js') || read(root, '.eleventy.js')
    || allDeps.has('@sveltejs/adapter-static')
    || ((read(root, 'hugo.toml') || (read(root, 'config.toml') && read(root, 'content/_index.md'))) && !pkgRaw));
  const isLibrary = deployTargets.length === 0 && !frameworks.has('nextjs') && isLibraryManifest(pkgRaw);

  return {
    languages: [...languages],
    frameworks: [...frameworks],
    sourceRoots: detectSourceRoots(root),
    manifests,
    services,                     // datastores tests need (postgres/redis/mysql/mongo/neo4j) → CI services:
    deployTargets,                // [] = no deploy manifest found (likely a library / static export)
    staticSite,                   // SSG (Astro/Eleventy/Hugo/SvelteKit-static)
    isLibrary,                    // importable package, no deploy manifest → published-library archetype
    ci: detectCI(root),           // CI platform(s) present
    tooling: detectTooling(root), // governance tools available (lint/typecheck/test/secret/dep…)
  };
}

// package.json has entry-point fields (importable) and isn't an obvious runnable app.
function isLibraryManifest(pkgRaw) {
  try {
    const pkg = JSON.parse(pkgRaw || '{}');
    const hasEntry = !!(pkg.main || pkg.module || pkg.exports || pkg.types || pkg.typings || pkg.bin);
    const scripts = pkg.scripts || {};
    const looksLikeApp = !!(scripts.start || scripts.dev || scripts.serve);
    return hasEntry && !looksLikeApp;
  } catch { return false; }
}

// Which datastores the test suite needs — so CI can spin them up as `services:` instead of letting
// DB-bound specs hang to timeout (the exact trap a "full suite" hits in CI with no services).
// Signals: declared client deps + any docker-compose images.
const SERVICE_DEPS = {
  postgres: [/^pg$/, /^postgres/, /^@?prisma/, /sequelize/, /typeorm/, /^knex$/, /pgvector/, /drizzle-orm/, /psycopg/, /asyncpg/, /sqlx/, /diesel/],
  mysql: [/^mysql2?$/, /mariadb/],
  mongo: [/^mongodb$/, /mongoose/, /pymongo/, /motor/],
  redis: [/^redis$/, /^ioredis$/, /bullmq?/, /^bull$/, /redis-py/],
  neo4j: [/neo4j/],
};
function detectServices(root, allDeps) {
  const found = new Set();
  for (const [svc, pats] of Object.entries(SERVICE_DEPS)) for (const d of allDeps) if (pats.some((p) => p.test(d))) { found.add(svc); break; }
  for (const f of ['docker-compose.yml', 'docker-compose.yaml', 'docker-compose.dev.yml', 'compose.yml']) {
    const txt = read(root, f); if (!txt) continue;
    if (/image:\s*\S*postgres|pgvector/i.test(txt)) found.add('postgres');
    if (/image:\s*\S*mysql|mariadb/i.test(txt)) found.add('mysql');
    if (/image:\s*\S*mongo/i.test(txt)) found.add('mongo');
    if (/image:\s*\S*redis/i.test(txt)) found.add('redis');
    if (/image:\s*\S*neo4j/i.test(txt)) found.add('neo4j');
  }
  return [...found];
}

// Merge deps across root + one level of apps/services/packages workspaces (monorepo-aware).
function collectAllDeps(root) {
  const deps = new Set();
  const add = (rel) => { try { const p = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); for (const k of ['dependencies', 'devDependencies']) Object.keys(p[k] || {}).forEach((d) => deps.add(d)); } catch {} };
  add('package.json');
  for (const dir of TOP_COMPONENT_DIRS) add(`${dir}/package.json`);
  for (const base of ['apps', 'services', 'packages']) {
    let entries = [];
    try { entries = fs.readdirSync(path.join(root, base), { withFileTypes: true }); } catch { continue; }
    for (const e of entries) if (e.isDirectory()) add(`${base}/${e.name}/package.json`);
  }
  return deps;
}

// Heuristic source-root detection (OQ4: per-root maps). Returns roots that exist.
function detectSourceRoots(root) {
  const candidates = [
    { path: 'src', kind: 'unknown' }, { path: 'server', kind: 'backend' },
    { path: 'backend', kind: 'backend' }, { path: 'api', kind: 'backend' },
    { path: 'client/src', kind: 'frontend' }, { path: 'frontend', kind: 'frontend' },
    { path: 'client', kind: 'frontend' }, { path: 'web', kind: 'frontend' },
    { path: 'mobile', kind: 'frontend' }, { path: 'app', kind: 'unknown' },
    { path: 'apps', kind: 'monorepo' }, { path: 'services', kind: 'monorepo' },
  ];
  const out = [];
  for (const c of candidates) {
    try {
      if (fs.statSync(path.join(root, c.path)).isDirectory()) out.push(c);
    } catch { /* not present */ }
  }
  if (out.length === 0) out.push({ path: '.', kind: 'unknown' });
  return out;
}

module.exports = { detect, detectSourceRoots, JS_FRAMEWORKS };
