// src/diagnostics/env-audit.js
// Env var completeness + diagnostics (research taxonomy §6 — a top "works locally / broke in prod"
// bug class). Finds every env var READ in code vs SET in .env*/example/compose, and diffs them:
//   read-but-never-set  -> a missing-in-prod risk (the runtime will get undefined)
//   set-but-never-read  -> dead config (stale .env entry)
// Deterministic (regex over code + dotenv/yaml parse). Stack-agnostic.
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../../lib/walk');

// env reads in code: process.env.X, process.env['X'], import.meta.env.X, Deno.env.get('X'),
// os.environ['X'] / os.getenv('X') (python), and config helpers env('X')/getenv('X').
function scanEnvReads(content) {
  const names = new Set();
  const code = String(content || '');
  for (const re of [
    /process\.env\.([A-Z0-9_]+)/g,
    /process\.env\[\s*['"]([A-Z0-9_]+)['"]\s*\]/g,
    /import\.meta\.env\.([A-Z0-9_]+)/g,
    /Deno\.env\.get\(\s*['"]([A-Z0-9_]+)['"]/g,
    /os\.environ(?:\.get)?\[?\(?\s*['"]([A-Z0-9_]+)['"]/g,
    /\bgetenv\(\s*['"]([A-Z0-9_]+)['"]/g,
    /(?<![A-Za-z])env\(\s*['"]([A-Z0-9_]+)['"]/g,
  ]) { let m; while ((m = re.exec(code)) !== null) names.add(m[1]); }
  return names;
}

// env sets from a .env-style or docker-compose env file (KEY=...  or  - KEY=... / KEY: ...).
function scanEnvSets(content) {
  const names = new Set();
  for (const line of String(content || '').split('\n')) {
    const l = line.trim();
    if (!l || l.startsWith('#')) continue;
    let m = l.match(/^(?:-\s*)?([A-Z0-9_]+)\s*[:=]/);
    if (m) names.add(m[1]);
  }
  return names;
}

const SET_FILES = ['.env', '.env.local', '.env.example', '.env.sample', '.env.production', '.env.development'];
const COMPOSE = ['docker-compose.yml', 'docker-compose.yaml', 'docker-compose.prod.yml', 'docker-compose.override.yml'];

function auditEnv(root, opts = {}) {
  const read = new Set();
  const exts = opts.exts || ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rb'];
  let files = [];
  try { files = walk(root, { include: exts }); } catch {}
  for (const abs of files) {
    if (/node_modules|\.test\.|\.spec\./.test(abs)) continue;
    let c = ''; try { c = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    for (const n of scanEnvReads(c)) read.add(n);
  }
  const set = new Set();
  for (const f of [...SET_FILES, ...COMPOSE]) {
    let c = ''; try { c = fs.readFileSync(path.join(root, f), 'utf8'); } catch { continue; }
    for (const n of scanEnvSets(c)) set.add(n);
  }
  // platform vars are set outside the repo (CI/dashboard) — don't flag obvious framework ones
  const PLATFORM = /^(NODE_ENV|PORT|HOME|PATH|CI|PWD|TZ|NODE_OPTIONS|npm_)/;
  const readNotSet = [...read].filter((n) => !set.has(n) && !PLATFORM.test(n)).sort();
  const setNotRead = [...set].filter((n) => !read.has(n) && !PLATFORM.test(n)).sort();
  return { readCount: read.size, setCount: set.size, readNotSet, setNotRead };
}

module.exports = { scanEnvReads, scanEnvSets, auditEnv };
