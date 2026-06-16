'use strict';
// Mature CI renderers — produce a senior-engineer's first-draft pipeline, not a toy. Implements the
// patterns in docs/gates/ci-maturity.md: stages, a cached `.base`/reusable template, one job PER GATE
// (block fails / advisory allow_failure|continue-on-error), workflow rules + auto-cancel, path-scoped
// rules per workspace, services for a detected datastore, built-in security scanning, and a guarded
// deploy scaffold. Takes the resolved two-tier gates (gate-config) + the detect() result.

// gate name → pipeline stage
function stageOf(name) {
  if (/\b(lint|format|typecheck|type-check|vet|fmt|clippy|rubocop)\b/i.test(name)) return 'lint';
  if (/\b(build|compile)\b/i.test(name)) return 'build';
  return 'test';
}
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function cmdOf(step) { return step.cwd ? `cd ${JSON.stringify(step.cwd)} && ${step.command}` : step.command; }
// CI variant of cmdOf: a fresh runner needs the component's install first (component-planned steps
// carry it; the LOCAL pre-push runner deliberately doesn't reinstall every push).
function ciCmd(step) {
  const inner = step.install ? `${step.install} && ${step.command}` : step.command;
  return step.cwd ? `cd ${JSON.stringify(step.cwd)} && ${inner}` : inner;
}
// secret-scan is handled by the built-in security templates, not a hand-rolled job.
const isSecurityGate = (s) => s.builtin || /secret-scan|sast|dep-audit|dependency/i.test(s.name);

// Pinned runtime versions from the repo itself (mise.toml > .nvmrc/go.mod/engines) — the generated
// pipeline must match the dev env, not a hardcoded tag (field testing: repo pins go 1.25 + node 24;
// the scaffold said golang:1.23/node:22).
function rv(detect) {
  if (!detect || !detect.root) return {};
  try { return require('./runtime-versions').runtimeVersions(detect.root); } catch { return {}; }
}
function baseImage(detect) {
  const l = new Set(detect.languages || []);
  const v = rv(detect);
  if (l.has('go')) return `golang:${v.go || '1.23'}`;
  if (l.has('rust')) return 'rust:1-slim';
  if (l.has('python')) return `python:${v.python || '3.12'}-slim`;
  if (l.has('ruby')) return 'ruby:3.3';
  return `node:${v.node || '22'}`;
}
function pm(detect) { return (detect.tooling || {}).packageManager || 'npm'; }
function installCmd(detect) {
  // The deploy config is ground truth: if a Dockerfile/nixpacks/vercel config declares the install the
  // HOST runs, mirror it — a guessed `npm ci` against a workspace with no lockfile fails forever while
  // the real deploy (npm install) sails through. detect.root is set by gen-ci; absent → heuristics.
  if (detect.root) {
    try { const m = require('./deploy-config').deployMirror(detect.root); if (m && m.install) return m.install; } catch { /* fall through to heuristics */ }
  }
  const l = new Set(detect.languages || []);
  if (l.has('go')) return 'go mod download';
  if (l.has('rust')) return 'cargo fetch';
  if (l.has('python')) return 'pip install -q -r requirements.txt 2>/dev/null || pip install -q -e . 2>/dev/null || true';
  const p = pm(detect);
  return p === 'pnpm' ? 'corepack enable && pnpm install --frozen-lockfile'
    : p === 'yarn' ? 'corepack enable && yarn install --immutable'
    : p === 'bun' ? 'bun install --frozen-lockfile'
    : 'npm ci || npm install';
}

// ── GitLab ────────────────────────────────────────────────────────────────
const GL_SERVICE_IMG = { postgres: 'postgres:16', mysql: 'mysql:8', mongo: 'mongo:7', redis: 'redis:7', neo4j: 'neo4j:5' };
function glCache(detect) {
  const l = new Set(detect.languages || []);
  if (l.has('go')) return ['  variables:', '    GOMODCACHE: ${CI_PROJECT_DIR}/.go', '  cache:', '    key: go-${CI_COMMIT_REF_SLUG}', '    fallback_keys: [go-${CI_DEFAULT_BRANCH}]', '    paths: [.go/]'];
  if (l.has('rust')) return ['  cache:', '    key: cargo-${CI_COMMIT_REF_SLUG}', '    paths: [.cargo/, target/]'];
  const p = pm(detect);
  if (p === 'pnpm') return ['  cache:', '    key: { files: [pnpm-lock.yaml] }', '    paths: [.pnpm-store/]'];
  if (l.has('javascript')) return ['  variables:', '    npm_config_cache: ${CI_PROJECT_DIR}/.npm', '  cache:', '    key: { files: [package-lock.json] }', '    paths: [.npm/]'];
  return [];
}
function glServices(detect) {
  if (!detect.services || !detect.services.length) return [];
  const out = ['  services:'];
  for (const s of detect.services) out.push(`    - name: ${GL_SERVICE_IMG[s] || s}`, `      alias: ${s}`);
  return out;
}

function renderGitlab(resolved, detect) {
  const img = baseImage(detect);
  const v = rv(detect);
  // Component-planned steps carry lang ('go'/'js') + cwd + install. When present, each lang gets its
  // own base template (right image, right cache) and jobs extend the matching one — a single .base
  // with one image can't serve a Go backend job AND a pnpm frontend job (field testing put `npm` lint
  // inside golang:1.23). Single-stack repos have no lang fields → exactly the old single-.base output.
  const allSteps = [...(resolved.block || []), ...(resolved.advisory || [])].filter((g) => !isSecurityGate(g));
  const langs = [...new Set(allSteps.map((s) => s.lang).filter(Boolean))];
  const multi = langs.length > 0;
  const langImg = (lang) => lang === 'go' ? `golang:${v.go || '1.23'}` : lang === 'js' ? `node:${v.node || '22'}` : img;
  const langTemplate = (lang) => {
    if (lang === 'go') return [`.lang-go:`, `  image: ${langImg('go')}`, '  variables:', '    GOMODCACHE: ${CI_PROJECT_DIR}/.go', '  cache:', '    key: go-${CI_COMMIT_REF_SLUG}', '    fallback_keys: [go-${CI_DEFAULT_BRANCH}]', '    paths: [.go/]'];
    return [`.lang-js:`, `  image: ${langImg('js')}`, '  cache:', '    key: js-${CI_COMMIT_REF_SLUG}', '    paths: [.pnpm-store/, .npm/]'];
  };
  const ws = (detect.sourceRoots || []).map((r) => r.path).filter((p) => /^(apps|services|packages)\//.test(p));
  const lines = [
    '# agentic-os pipeline — mature scaffold (stages · cache · per-gate jobs · services · deploy). Edit freely.',
    'stages: [lint, test, build, deploy]',
    '',
    'workflow:',
    '  auto_cancel: { on_new_commit: interruptible }',
    '  rules:',
    '    - if: \'$CI_COMMIT_MESSAGE =~ /\\[skip ci\\]/\'',
    '      when: never',
    '    - if: \'$CI_PIPELINE_SOURCE == "merge_request_event"\'',
    '    - if: \'$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\'',
    '',
    '# Free, zero-config security scanning (covers the secret-scan / dep-audit gates).',
    'include:',
    '  - template: Security/Secret-Detection.gitlab-ci.yml',
    '  - template: Security/SAST.gitlab-ci.yml',
    '  - template: Security/Dependency-Scanning.gitlab-ci.yml',
    '',
    'default:',
    '  interruptible: true',
    `  image: ${img}`,
    '',
  ];
  if (multi) {
    for (const lang of langs) lines.push(...langTemplate(lang), '');
  } else {
    lines.push('.base:', `  image: ${img}`, ...glCache(detect), '  before_script:', `    - ${installCmd(detect)}`, '');
  }
  const job = (s, advisory) => {
    const st = stageOf(s.name);
    const tpl = multi && s.lang ? `.lang-${s.lang}` : multi ? null : '.base';
    const out = [`${slug(s.name)}:`, `  stage: ${st}`];
    if (tpl) out.push(`  extends: ${tpl}`);
    out.push('  needs: []');
    // Path-scope the job to its component (component-planned) or the workspace dirs (monorepo).
    const scope = s.cwd ? [s.cwd] : ws;
    if (scope.length) { out.push('  rules:', '    - if: \'$CI_PIPELINE_SOURCE == "merge_request_event"\'', `      changes: [${scope.map((w) => w + '/**/*').join(', ')}]`, '    - if: \'$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\''); }
    if (st === 'test') out.push(...glServices(detect));
    out.push(`  script: [${JSON.stringify(multi ? ciCmd(s) : cmdOf(s))}]`);
    if (st === 'test') out.push("  coverage: '/(?:All files|total).*?([0-9.]+)%/'");
    if (advisory) out.push('  allow_failure: true');
    return out.join('\n');
  };
  for (const s of resolved.block.filter((g) => !isSecurityGate(g))) lines.push(job(s, false), '');
  for (const s of resolved.advisory.filter((g) => !isSecurityGate(g))) lines.push(job(s, true), '');
  lines.push(
    '# Deploy scaffold — guarded, tracked as a GitLab Environment. Fill in your host command.',
    'deploy:',
    '  stage: deploy',
    '  needs: []',
    '  rules:',
    '    - if: \'$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\'',
    '      when: manual',
    '  environment: { name: production }',
    '  script:',
    '    - echo "TODO: deploy command (kamal deploy / flyctl deploy / railway up / vercel --prod / …)"',
    '',
  );
  return lines.join('\n');
}

// ── GitHub Actions ──────────────────────────────────────────────────────────
const GH_SERVICE = {
  postgres: '    postgres:\n      image: postgres:16\n      env: { POSTGRES_PASSWORD: postgres }\n      ports: ["5432:5432"]\n      options: --health-cmd "pg_isready" --health-interval 10s --health-timeout 5s --health-retries 5',
  mysql: '    mysql:\n      image: mysql:8\n      env: { MYSQL_ROOT_PASSWORD: root }\n      ports: ["3306:3306"]',
  mongo: '    mongo:\n      image: mongo:7\n      ports: ["27017:27017"]',
  redis: '    redis:\n      image: redis:7\n      ports: ["6379:6379"]',
  neo4j: '    neo4j:\n      image: neo4j:5\n      env: { NEO4J_AUTH: neo4j/password }\n      ports: ["7687:7687"]',
};
function ghSetup(detect, step = null) {
  // step = a component-planned gate step ({lang, cwd, install}) → per-job toolchain; null → repo-level.
  const l = new Set(detect.languages || []);
  const v = rv(detect);
  const lang = step && step.lang;
  if (lang === 'go' || (!lang && l.has('go'))) return ['      - uses: actions/setup-go@v5', `        with: { go-version: "${v.go || '1.23'}", cache: true }`];
  if (!lang && l.has('python')) return ['      - uses: actions/setup-python@v5', `        with: { python-version: '${v.python || '3.12'}', cache: 'pip' }`];
  if (!lang && l.has('rust')) return ['      - uses: dtolnay/rust-toolchain@stable'];
  const p = lang === 'js' && step && step.install
    ? (step.install.includes('pnpm') ? 'pnpm' : step.install.includes('yarn') ? 'yarn' : step.install.includes('bun') ? 'bun' : 'npm')
    : pm(detect);
  const cache = p === 'pnpm' ? 'pnpm' : p === 'yarn' ? 'yarn' : 'npm';
  const lock = p === 'pnpm' ? 'pnpm-lock.yaml' : p === 'yarn' ? 'yarn.lock' : 'package-lock.json';
  const pre = p === 'pnpm' ? ['      - uses: pnpm/action-setup@v4'] : [];
  const dep = step && step.cwd ? `, cache-dependency-path: ${step.cwd}/${lock}` : '';
  return [...pre, '      - uses: actions/setup-node@v4', `        with: { node-version: ${v.node || '22'}, cache: ${cache}${dep} }`];
}

function renderGithub(resolved, detect) {
  const setup = ghSetup(detect);
  const inst = installCmd(detect);
  const svc = (detect.services || []).map((s) => GH_SERVICE[s]).filter(Boolean);
  const job = (s, advisory) => {
    const st = stageOf(s.name);
    const out = [`  ${slug(s.name)}:`, `    runs-on: ubuntu-latest`];
    if (st === 'test' && svc.length) out.push('    services:', ...svc.map((b) => b.replace(/^/gm, '  ')));
    // Component-planned steps ({lang,cwd,install}) get their OWN toolchain setup + a self-contained
    // run (install folded in); repo-level steps keep the shared setup + install pair.
    if (s.lang) out.push('    steps:', '      - uses: actions/checkout@v4', ...ghSetup(detect, s), `      - run: ${ciCmd(s)}`);
    else out.push('    steps:', '      - uses: actions/checkout@v4', ...setup, `      - run: ${inst}`, `      - run: ${cmdOf(s)}`);
    if (advisory) out.push('        continue-on-error: true');
    return out.join('\n');
  };
  const lines = [
    '# agentic-os pipeline — mature scaffold (concurrency · cache · services · per-gate jobs · deploy). Edit freely.',
    'name: CI',
    'on:',
    '  push: { branches: [main] }',
    '  pull_request:',
    'concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }',
    'permissions: { contents: read }',
    'jobs:',
  ];
  for (const s of resolved.block.filter((g) => !g.builtin)) lines.push(job(s, false));
  for (const s of resolved.advisory.filter((g) => !g.builtin)) lines.push(job(s, true));
  lines.push(
    '  deploy:',
    '    runs-on: ubuntu-latest',
    `    needs: [${resolved.block.filter((g) => !g.builtin).map((g) => slug(g.name)).join(', ')}]`,
    "    if: github.ref == 'refs/heads/main'",
    '    environment: production',
    '    steps:',
    '      - run: echo "TODO: deploy command (flyctl deploy / railway up / vercel --prod / kamal deploy / …)"',
    '',
  );
  return lines.join('\n');
}

module.exports = { renderGitlab, renderGithub, stageOf, baseImage, installCmd };
