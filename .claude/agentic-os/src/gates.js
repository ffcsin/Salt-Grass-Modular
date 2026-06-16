// src/gates.js
// The governance gate pack. planGates() is PURE — it turns a StackProfile + repo scripts into an
// ordered list of {gate, command, skip} without running anything (testable). runGates() executes
// them. Philosophy (ADR-0005): a gate whose tool/config is absent is SKIPPED, never failed
// — warn-never-crash. Prefer the repo's OWN scripts (npm run lint) over guessing tool invocation.
const { execSync } = require('node:child_process');

// Builtin secret scanner — always available (no external tool needed). Conservative, high-signal.
const SECRET_PATTERNS = [
  [/sk-ant-[a-zA-Z0-9-]{20,}/, 'Anthropic API key'],
  [/sk-[a-zA-Z0-9]{32,}/, 'OpenAI-style key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bghp_[A-Za-z0-9]{36}\b/, 'GitHub personal access token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/postgres(ql)?:\/\/[^\s:@]+:[^\s:@]+@/, 'Postgres URL with inline credentials'],
];
function scanSecrets(text) {
  const hits = [];
  const lines = String(text || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    // only added lines in a diff (start with '+', not '+++')
    const l = lines[i];
    if (l.startsWith('+++') || (text.includes('\n+') && !l.startsWith('+') && /^[ +-]/.test(l))) continue;
    for (const [re, label] of SECRET_PATTERNS) if (re.test(l)) hits.push({ label, line: i + 1, sample: l.slice(0, 80) });
  }
  return hits;
}

const pmRun = (pm, script) => `${pm || 'npm'} run ${script}`;

// Build the ordered gate plan. `scripts` = root package.json scripts. Prefers repo scripts.
function planGates(detect, scripts = {}) {
  const t = (detect && detect.tooling) || {};
  const pm = t.packageManager || 'npm';
  const plan = [];
  const add = (gate, command, skip) => plan.push(command ? { gate, command } : { gate, skip: skip || 'no tool detected' });

  // lint — tools go through the pm's exec wrapper, never `<pm> <tool>` (`npm biome check .` is not
  // a thing; npm treats `biome` as an npm subcommand and dies. Caught in field testing.)
  const exec = (cmd) => (pm === 'npm' ? `npx --no-install ${cmd}` : pm === 'bun' ? `bunx ${cmd}` : `${pm} exec ${cmd}`);
  add('lint', scripts.lint ? pmRun(pm, 'lint')
    : t.lint === 'biome' ? exec('biome check .')
    : t.lint === 'eslint' ? exec('eslint .')
    : t.lint === 'ruff' ? `ruff check .` : null);
  // typecheck
  add('typecheck', scripts.typecheck ? pmRun(pm, 'typecheck')
    : t.typecheck === 'tsc' ? `npx --no-install tsc --noEmit`
    : t.typecheck === 'mypy' ? `mypy .` : null);
  // tests — prefer an explicit run-once script (test:ci/test:run) over `test`: a bare `vitest`
  // test script is WATCH MODE and hangs a pre-push hook forever waiting for a TTY (field testing).
  const testScript = scripts['test:ci'] ? 'test:ci' : scripts['test:run'] ? 'test:run' : scripts.test ? 'test' : null;
  add('test', testScript ? pmRun(pm, testScript)
    : t.test === 'vitest' ? `npx --no-install vitest run`
    : t.test === 'jest' ? `npx --no-install jest`
    : t.test === 'pytest' ? `pytest -q` : null);
  // SAST (only if semgrep config present; the CLI is probed at runtime)
  add('sast', t.sast === 'semgrep' ? `semgrep --error --config .semgrep` : null, 'no semgrep config');
  // dependency audit
  add('dep-audit', t.depAudit === 'npm-or-osv' ? `${pm} audit --audit-level=high`
    : t.depAudit === 'pip-audit' ? `pip-audit` : null);
  // secret scan is always present (builtin) — handled specially in runGates
  plan.push({ gate: 'secret-scan', builtin: true });
  return plan;
}

function runOne(root, command) {
  try { const out = execSync(command, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 10 * 60 * 1000 }); return { ok: true, output: String(out).slice(-2000) }; }
  catch (e) { return { ok: false, output: String((e.stdout || '') + (e.stderr || e.message || '')).slice(-2000) }; }
}

function runGates(root, detect, scripts) {
  const plan = planGates(detect, scripts);
  const results = [];
  for (const step of plan) {
    if (step.skip) { results.push({ gate: step.gate, status: 'skipped', reason: step.skip }); continue; }
    if (step.builtin) {
      let diff = '';
      try { diff = execSync('git diff --cached -U0', { cwd: root, encoding: 'utf8' }); } catch {}
      if (!diff) { try { diff = execSync('git diff -U0', { cwd: root, encoding: 'utf8' }); } catch {} }
      const hits = scanSecrets(diff);
      results.push({ gate: 'secret-scan', status: hits.length ? 'fail' : 'pass', findings: hits });
      continue;
    }
    const r = runOne(root, step.command);
    results.push({ gate: step.gate, status: r.ok ? 'pass' : 'fail', command: step.command, output: r.ok ? undefined : r.output });
  }
  const failed = results.filter((r) => r.status === 'fail');
  return { results, ok: failed.length === 0, failed: failed.map((f) => f.gate) };
}

module.exports = { planGates, scanSecrets, runGates, SECRET_PATTERNS };
