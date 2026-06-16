'use strict';
// Deploy-config parser — read what the HOST actually runs instead of guessing. The lesson behind it
// (field testing, 2026-06-09): CI guessed `npm ci`, but the Railway Dockerfile runs a standalone `npm install`
// (no lockfile in that workspace) — so CI died for months on a wall the deploy never hit. The deploy
// config is the ground truth for the install + build commands; the deploy-mirror gate must copy it.
// Parsers are line-based and dependency-free (no yaml/toml libs); they extract, never execute.
const fs = require('node:fs');
const path = require('node:path');

const INSTALL_RE = /\b(npm (ci|install)\b[^&|;]*|yarn(?: install)?(?: --[a-z-]+)*|pnpm (?:i|install)\b[^&|;]*|bun install[^&|;]*|pip install[^&|;]*|poetry install[^&|;]*|uv sync[^&|;]*|bundle install[^&|;]*|go mod download|cargo fetch)/;
const BUILD_RE = /\b((?:npm|yarn|pnpm|bun) run build\b[^&|;]*|next build[^&|;]*|nest build[^&|;]*|vite build[^&|;]*|astro build[^&|;]*|tsc -b[^&|;]*|go build[^&|;]*|cargo build[^&|;]*|mvn package[^&|;]*|gradle build[^&|;]*)/;

function firstMatch(re, text) { const m = String(text || '').match(re); return m ? m[1].trim() : null; }

// Dockerfile: RUN lines hold the truth. First install-looking RUN + first build-looking RUN.
function parseDockerfile(text) {
  const runs = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*RUN\s+(.+)$/i);
    if (m) runs.push(m[1]);
  }
  return {
    install: runs.map((r) => firstMatch(INSTALL_RE, r)).find(Boolean) || null,
    build: runs.map((r) => firstMatch(BUILD_RE, r)).find(Boolean) || null,
  };
}

// nixpacks.toml: [phases.install] cmds = [...] / [phases.build] cmds = [...] (TOML-lite line scan).
function parseNixpacks(text) {
  const out = { install: null, build: null };
  let section = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    const sec = line.match(/^\s*\[phases\.(install|build)\]/);
    if (sec) { section = sec[1]; continue; }
    if (/^\s*\[/.test(line)) { section = null; continue; }
    if (section && /cmds?\s*=/.test(line)) {
      const cmd = (line.match(/["']([^"']+)["']/) || [])[1];
      if (cmd && !out[section]) out[section] = cmd.trim();
    }
  }
  return out;
}

// vercel.json: explicit installCommand/buildCommand override what Vercel infers.
function parseVercelJson(text) {
  try { const j = JSON.parse(text); return { install: j.installCommand || null, build: j.buildCommand || null }; }
  catch { return { install: null, build: null }; }
}

// netlify.toml: [build] command = "..."
function parseNetlifyToml(text) {
  const out = { install: null, build: null };
  let inBuild = false;
  for (const line of String(text || '').split(/\r?\n/)) {
    if (/^\s*\[build\]/.test(line)) { inBuild = true; continue; }
    if (/^\s*\[/.test(line)) { inBuild = false; continue; }
    if (inBuild) { const m = line.match(/^\s*command\s*=\s*["']([^"']+)["']/); if (m) out.build = m[1].trim(); }
  }
  return out;
}

// railway.json/toml: points at a Dockerfile (builder DOCKERFILE) — resolve + parse it.
function parseRailway(text, dir) {
  try {
    const j = JSON.parse(text);
    const df = (j.build && (j.build.dockerfile || j.build.dockerfilePath)) || null;
    if (df) {
      const abs = path.join(dir, df);
      if (fs.existsSync(abs)) return { ...parseDockerfile(fs.readFileSync(abs, 'utf8')), via: df };
    }
  } catch { /* railway.toml or malformed → nothing to extract here */ }
  return { install: null, build: null };
}

const SOURCES = [
  ['Dockerfile', (t) => parseDockerfile(t)],
  ['nixpacks.toml', (t) => parseNixpacks(t)],
  ['vercel.json', (t) => parseVercelJson(t)],
  ['netlify.toml', (t) => parseNetlifyToml(t)],
  ['railway.json', (t, dir) => parseRailway(t, dir)],
];

// Scan root + one level of workspaces for deploy configs → [{dir, file, install, build}].
// Multiple hits per dir are all returned (a Dockerfile AND a nixpacks.toml may both exist — Railway
// prefers the Dockerfile when railway.json says builder DOCKERFILE; the caller sees both and decides).
function deployCommands(root) {
  const found = [];
  const dirs = ['.'];
  for (const base of ['apps', 'services', 'packages']) {
    let entries = [];
    try { entries = fs.readdirSync(path.join(root, base), { withFileTypes: true }); } catch { continue; }
    for (const e of entries) if (e.isDirectory()) dirs.push(`${base}/${e.name}`);
  }
  // Conventional top-level component dirs (backend/Dockerfile + frontend/Dockerfile — a per-component deploy layout).
  for (const d of ['backend', 'frontend', 'server', 'client', 'web', 'api', 'mobile']) {
    try { if (fs.statSync(path.join(root, d)).isDirectory()) dirs.push(d); } catch { /* absent */ }
  }
  for (const dir of dirs) {
    for (const [file, parse] of SOURCES) {
      const abs = path.join(root, dir, file);
      let text = null;
      try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
      const r = parse(text, path.join(root, dir));
      if (r.install || r.build) found.push({ dir, file, install: r.install || null, build: r.build || null });
    }
  }
  return found;
}

// The single best deploy-mirror pair for a dir (or the repo): Dockerfile wins (it IS the build env),
// then nixpacks, then vercel/netlify.
function deployMirror(root, dir = null) {
  const all = deployCommands(root).filter((d) => (dir ? d.dir === dir : true));
  const order = ['Dockerfile', 'railway.json', 'nixpacks.toml', 'vercel.json', 'netlify.toml'];
  all.sort((a, b) => order.indexOf(a.file) - order.indexOf(b.file));
  return all[0] || null;
}

module.exports = { parseDockerfile, parseNixpacks, parseVercelJson, parseNetlifyToml, parseRailway, deployCommands, deployMirror };
