'use strict';
// CI import + critique. When a repo ALREADY has CI (GitHub Actions / GitLab CI / others), this:
//   (a) EXTRACTS the check commands those pipelines run, so the LOCAL pre-push can MIRROR them — you find
//       the same failures before the push, not after, and
//   (b) CRITIQUES the existing pipeline against the recommended gate pack: what's covered, what's missing,
//       what to add ("better or more").
// Zero-dep: pragmatic line-based YAML scanning (no yaml library) — enough to enumerate `run:`/`script:`
// shell steps. NEVER executes anything; pure extraction + analysis.
const fs = require('node:fs');
const path = require('node:path');
const { detectTooling } = require('./detect-ci');

// ── command classification ────────────────────────────────────────────────
// Map a shell command to the gate category it satisfies (or null if it's not a check we mirror).
const CLASSIFIERS = [
  ['lint', /\b(eslint|biome\s+(ci|lint|check)|\bruff\b|\blint\b|standardjs|xo)\b/i],
  ['format', /\b(prettier|biome\s+format|\bfmt\b|\bformat\b|black\s|gofmt)\b/i],
  ['typecheck', /\b(tsc\b|tsc\s|type-?check|\bmypy\b|pyright|\btsd\b)\b/i],
  ['test', /\b(jest|vitest|mocha|ava|pytest|go\s+test|cargo\s+test|rspec|phpunit|node\s+--test|npm\s+(run\s+)?test|yarn\s+test|pnpm\s+test)\b/i],
  ['secret-scan', /\b(gitleaks|trufflehog|detect-secrets|ggshield)\b/i],
  ['dep-audit', /\b(npm\s+audit|yarn\s+audit|pnpm\s+audit|osv-scanner|pip-audit|bundler-audit|cargo\s+audit|snyk\s+test)\b/i],
  ['sast', /\b(semgrep|codeql|bandit|brakeman|snyk\s+code)\b/i],
  ['build', /\b(npm\s+run\s+build|yarn\s+build|pnpm\s+build|next\s+build|vite\s+build|tsc\s+-b|webpack|rollup|esbuild|go\s+build|cargo\s+build|make\b)\b/i],
];
// Commands we never mirror into a LOCAL pre-push (slow / side-effecting / deploy).
const SKIP = /\b(deploy|publish|release|docker\s+push|npm\s+publish|gh\s+release|terraform\s+apply|kubectl\s+apply|aws\s+s3|vercel\s+--prod|railway\s+up|netlify\s+deploy|actions\/checkout|actions\/setup|setup-node|setup-python|cache@|upload-artifact)\b/i;

function classifyCommand(cmd) {
  const c = String(cmd || '').trim();
  if (!c || SKIP.test(c)) return null;
  for (const [cat, re] of CLASSIFIERS) if (re.test(c)) return cat;
  return null;
}

// ── YAML command extraction (line-based, no yaml dep) ─────────────────────
// Pulls shell commands out of CI YAML. Handles GH Actions `run:` (inline + block scalar `|`/`>`) and
// GitLab `script:`/`before_script:`/`after_script:` list items. Heuristic but sufficient to enumerate.
function extractCommandsFromYaml(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  const indentOf = (l) => l.length - l.replace(/^\s+/, '').length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // GH Actions: `run: <inline>`  or  `run: |` / `run: >` block scalar
    let m = trimmed.match(/^(?:-\s*)?run:\s*(.*)$/);
    if (m) {
      const rest = m[1].trim();
      if (rest && rest !== '|' && rest !== '>' && !/^[|>][+-]?$/.test(rest)) { out.push(rest); continue; }
      // block scalar: collect deeper-indented lines
      const base = indentOf(line);
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim()) continue;
        if (indentOf(lines[j]) <= base) break;
        out.push(lines[j].trim());
        i = j;
      }
      continue;
    }

    // GitLab: `script:` / `before_script:` / `after_script:` followed by `- cmd` items
    m = trimmed.match(/^(?:-\s*)?(?:before_script|after_script|script):\s*(.*)$/);
    if (m) {
      const inline = m[1].trim();
      if (inline && inline !== '|' && inline !== '>') {
        // could be `script: cmd` or `script: [a, b]`
        if (inline.startsWith('[')) { for (const part of inline.replace(/^\[|\]$/g, '').split(',')) { const p = part.trim().replace(/^['"]|['"]$/g, ''); if (p) out.push(p); } }
        else out.push(inline.replace(/^['"]|['"]$/g, ''));
        continue;
      }
      const base = indentOf(line);
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim()) continue;
        if (indentOf(lines[j]) <= base) break;
        const item = lines[j].trim().replace(/^-\s*/, '').replace(/^['"]|['"]$/g, '');
        if (item) out.push(item);
        i = j;
      }
      continue;
    }
  }
  // de-dup, preserve order
  return [...new Set(out.map((c) => c.trim()).filter(Boolean))];
}

// ── existing-CI discovery ─────────────────────────────────────────────────
// agentic-os's OWN generated CI files — excluded so the critique reflects the repo's PRE-EXISTING CI,
// not the config we just wrote (otherwise coverage is circular and always "complete").
const GENERATED = /(^|\/)(agentic-os-checks\.ya?ml|gitlab-ci\.agentic-os\.ya?ml)$/i;

function listCiFiles(root) {
  const files = [];
  const wf = path.join(root, '.github', 'workflows');
  try { for (const f of fs.readdirSync(wf)) if (/\.ya?ml$/i.test(f)) files.push(`.github/workflows/${f}`); } catch {}
  for (const f of ['.gitlab-ci.yml', '.circleci/config.yml', 'bitbucket-pipelines.yml', 'azure-pipelines.yml']) {
    try { fs.accessSync(path.join(root, f)); files.push(f); } catch {}
  }
  // GitLab modular pipelines: .gitlab-ci.yml is often just `include: - local: .gitlab/ci/<job>.yml`
  // with every actual job in the included files. Follow local includes (one level) — without this a
  // mature modular pipeline critiques as "covers none of the recommended gates" (field testing).
  const glMain = files.includes('.gitlab-ci.yml') ? fs.readFileSync(path.join(root, '.gitlab-ci.yml'), 'utf8') : '';
  for (const m of glMain.matchAll(/-\s*local:\s*["']?([^"'\s]+)["']?/g)) {
    const rel = m[1].replace(/^\//, '');
    try { fs.accessSync(path.join(root, rel)); if (!files.includes(rel)) files.push(rel); } catch {}
  }
  return files.filter((f) => !GENERATED.test(f));
}

// Parse every existing CI file → { files, commands, checks } (checks = classified mirror-worthy commands).
function parseExistingCI(root) {
  const files = listCiFiles(root);
  const commands = [];
  for (const rel of files) {
    let text = '';
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    for (const c of extractCommandsFromYaml(text)) commands.push(c);
  }
  const uniqCmds = [...new Set(commands)];
  const checks = uniqCmds.map((command) => ({ command, category: classifyCommand(command) })).filter((x) => x.category);
  const categories = [...new Set(checks.map((c) => c.category))];
  return { files, commands: uniqCmds, checks, categories };
}

// ── critique: existing CI vs the recommended gate pack ────────────────────
// The core gates we recommend any repo run, gated by whether the repo HAS the tool (don't tell a
// Python repo to add tsc). secret-scan is always recommended (builtin regex fallback needs no tool).
function recommendedGates(root) {
  const t = detectTooling(root);
  const rec = [];
  if (t.lint) rec.push('lint');
  if (t.typecheck) rec.push('typecheck');
  if (t.test) rec.push('test');
  if (t.depAudit) rec.push('dep-audit');
  rec.push('secret-scan'); // always — builtin fallback
  return rec;
}

const GATE_HOWTO = {
  lint: 'add your linter (eslint/biome/ruff) as a CI + pre-push step',
  typecheck: 'add a typecheck step (tsc --noEmit / mypy)',
  test: 'add your test command as a CI + pre-push step',
  'dep-audit': 'add a dependency audit (npm audit / pip-audit / osv-scanner)',
  'secret-scan': 'add a secret scan (gitleaks, or the builtin regex scan in .ecosystem/ci-check.sh)',
  sast: 'consider a SAST pass (semgrep) for deeper static analysis',
};

function critiqueCI(root) {
  const existing = parseExistingCI(root);
  const have = new Set(existing.categories);
  const rec = recommendedGates(root);
  const covered = rec.filter((g) => have.has(g));
  const missing = rec.filter((g) => !have.has(g));
  const suggestions = missing.map((g) => ({ gate: g, how: GATE_HOWTO[g] || `add a ${g} gate` }));
  // agentic-os always adds value no stock CI has: map-drift critique + phantom/behavioral diff guards.
  suggestions.push({ gate: 'agentic-os-checks', how: 'wire `.ecosystem/ci-check.sh` into CI (map-drift + secret + phantom coverage stock pipelines lack)' });
  return {
    hasExistingCI: existing.files.length > 0,
    files: existing.files,
    covered,
    missing,
    extras: existing.categories.filter((c) => !rec.includes(c)), // build/format/sast they already run
    mirrorable: existing.checks,                                  // commands we can run locally pre-push
    suggestions,
  };
}

module.exports = { classifyCommand, extractCommandsFromYaml, listCiFiles, parseExistingCI, recommendedGates, critiqueCI };
