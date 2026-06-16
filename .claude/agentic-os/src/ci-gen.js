// src/ci-gen.js
// Generate self-contained CI configs (GitHub Actions / GitLab CI / generic shell) from the gate
// plan. The generated CI runs the repo's OWN tools (from planGates) — zero agentic-os dependency at
// CI time. The agentic-os-specific gates (map-drift critique, deep-map verify) run in the LOCAL
// pre-push hook where the plugin is present, and can be layered into CI later via a vendored runner.
const { planGates } = require('./gates');

// Concrete shell steps from the plan (skip gates with no command; keep builtin secret-scan as grep).
function ciSteps(detect, scripts = {}) {
  const steps = [];
  for (const g of planGates(detect, scripts)) {
    if (g.command) steps.push({ name: g.gate, run: g.command });
    else if (g.builtin && g.gate === 'secret-scan') {
      // portable secret scan over the diff — no external tool. Fails (exit 1) on a match.
      steps.push({ name: 'secret-scan', run: `git diff --no-color | grep -nE 'sk-ant-[a-zA-Z0-9-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(ql)?://[^[:space:]:@]+:[^[:space:]:@]+@' && { echo 'secret detected'; exit 1; } || echo 'no secrets'` });
    }
  }
  return steps;
}

function installCmd(pm) {
  return pm === 'bun' ? 'bun install --frozen-lockfile'
    : pm === 'pnpm' ? 'pnpm install --frozen-lockfile'
    : pm === 'yarn' ? 'yarn install --frozen-lockfile'
    : 'npm ci';
}

function githubYaml(detect, scripts, opts = {}) {
  const pm = (detect.tooling || {}).packageManager || 'npm';
  const steps = ciSteps(detect, scripts);
  // Advisory (default) = gates report but don't fail the build — right for a repo that doesn't yet
  // pass its own gates (pre-existing tech debt). Flip with --enforce.
  const adv = opts.advisory !== false ? '\n        continue-on-error: true' : '';
  const lines = [
    'name: agentic-os checks', 'on: [push, pull_request]', 'jobs:', '  checks:', '    runs-on: ubuntu-latest', '    steps:',
    '      - uses: actions/checkout@v4',
    ...(pm === 'bun' ? ['      - uses: oven-sh/setup-bun@v2'] : ['      - uses: actions/setup-node@v4', "        with: { node-version: '22' }"]),
    `      - name: install\n        run: ${installCmd(pm)}${adv}`,
    ...steps.map((s) => `      - name: ${s.name}\n        run: ${s.run}${adv}`),
  ];
  return lines.join('\n') + '\n';
}

function gitlabYaml(detect, scripts) {
  const pm = (detect.tooling || {}).packageManager || 'npm';
  const steps = ciSteps(detect, scripts);
  const lines = [
    '# agentic-os checks', 'stages: [check]',
    'agentic-os-checks:', '  stage: check', "  image: node:22",
    '  script:', `    - ${installCmd(pm)}`,
    ...steps.map((s) => `    - ${s.run}`),
  ];
  return lines.join('\n') + '\n';
}

// Portable shell any CI (or the pre-push hook) can call. Runs each gate; collects failures; exits 1
// if any failed (still runs them all so you see every failure at once).
function genericSh(detect, scripts) {
  const steps = ciSteps(detect, scripts);
  const body = steps.map((s) => `run_gate "${s.name}" ${JSON.stringify(s.run)}`).join('\n');
  return `#!/usr/bin/env bash
# agentic-os checks — generated. Runs the repo's gate pack; exits non-zero if any gate fails.
set -uo pipefail
FAILED=()
run_gate() { echo "── $1"; bash -c "$2"; if [ $? -ne 0 ]; then FAILED+=("$1"); fi; }
${body}
if [ \${#FAILED[@]} -ne 0 ]; then echo "❌ failed gates: \${FAILED[*]}"; exit 1; fi
echo "✅ all gates passed"
`;
}

module.exports = { ciSteps, githubYaml, gitlabYaml, genericSh };
