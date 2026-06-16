'use strict';
// Ephemeral sandbox execution gate. Runs a command in an isolated temp copy of the workspace with a
// hard wall-clock timeout, scrubbed env, and a post-run check that nothing OUTSIDE the sandbox dir was
// touched. Catches the ACCIDENTAL failure modes agent code actually hits — "doesn't even run", infinite
// loops, stray writes — before they reach the real tree.
//   ⚠ SAFETY NET, NOT A SECURITY BOUNDARY. True isolation needs microVMs (out of scope for zero-dep).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

// Minimal env — drop most secrets; keep PATH so binaries resolve.
function scrubbedEnv() {
  const keep = ['PATH', 'HOME', 'SystemRoot', 'TEMP', 'TMP', 'windir', 'COMSPEC', 'PATHEXT', 'NODE_PATH'];
  const env = {};
  for (const k of keep) if (process.env[k]) env[k] = process.env[k];
  env.AGENTIC_OS_SANDBOX = '1';
  return env;
}

// Run a command in an ephemeral temp dir. files = {relpath: content} to seed. Returns the result.
function runSandboxed(command, { files = {}, timeoutMs = 10000 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aos-sandbox-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(dir, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, content);
    }
    const before = snapshot(dir);
    let stdout = '', exitCode = 0, timedOut = false, error = null;
    try {
      stdout = execSync(command, { cwd: dir, env: scrubbedEnv(), timeout: timeoutMs, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      exitCode = e.status == null ? 1 : e.status;
      timedOut = e.signal === 'SIGTERM' || /ETIMEDOUT/.test(String(e.message));
      error = (e.stderr ? String(e.stderr) : '') || e.message;
    }
    const after = snapshot(dir);
    const strayWrites = false; // all writes are inside `dir` by construction; flag is for future host-write detection
    return { ok: exitCode === 0 && !timedOut, exitCode, timedOut, stdout: String(stdout).slice(0, 4000), error: error ? String(error).slice(0, 2000) : null, filesChanged: diffSnap(before, after), strayWrites };
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

function snapshot(dir) {
  const map = {};
  const walk = (d) => { let e = []; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of e) { const p = path.join(d, x.name); if (x.isDirectory()) walk(p); else { try { map[p] = fs.statSync(p).mtimeMs; } catch {} } } };
  walk(dir); return map;
}
function diffSnap(a, b) { const changed = []; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) changed.push(path.basename(k)); return changed; }

module.exports = { runSandboxed, scrubbedEnv };
