# agentic-os — Upstream Fixes for Michael

**From:** Salt-Grass-Modular bootstrap (2026-06-16, Claude Code v2.1.172, macOS, Opus 4.8)
**Repo to patch:** `dronequote/agentic-os` (plugin v0.3.0)
**Why this doc:** Bootstrapping agentic-os onto a fresh **Astro** repo surfaced 4 issues. Two are
**blocking** (the install silently doesn't enforce / crashes on startup) and were only gotten around
with manual workarounds. Fixing them upstream means the next repo installs clean with zero manual steps.

---

## 🔴 FIX 1 — `bootstrap-ecosystem` never wires the hooks (BLOCKING)

**Symptom:** After running `/agentic-os:bootstrap-ecosystem`, the repo had `.ecosystem/`, `CLAUDE.md`,
`AGENTS.md`, CI, and the pre-push git hook — but **no `.claude/settings.json` and no
`.claude/agentic-os/` runtime**. So none of the 5 enforcement hooks (SessionStart, UserPromptSubmit,
PreToolUse, PostToolUse, Stop) actually fired. The install *looked* done but was unenforced.

**Root cause:** The `bootstrap-ecosystem` skill's step list (steps 5–5c) runs `docgen`, `hooks-config`,
`gen-agents-md`, `gen-ci`, `ci-sync`, `install-git-hooks` — but **never calls
`bin/install-claude-hooks.js`**, which is the script that writes `.claude/settings.json` (merged) and
copies the `.claude/agentic-os/` runtime. `INSTALL.md` names that file for *updates* but the bootstrap
flow itself omits it.

**Fix:** Add an explicit step to `skills/bootstrap-ecosystem/SKILL.md` (in Phase 5b/5c) :

```
- Wire the repo-local enforcement hooks + runtime:
  node "<plugin>/bin/install-claude-hooks.js" "<target>"
  (writes/merges .claude/settings.json with the 5 hook events + copies .claude/agentic-os/ runtime)
```

**Manual workaround used:** ran `node ~/Projects/agentic-os/bin/install-claude-hooks.js <repo>` by hand.

---

## 🔴 FIX 2 — repo-local hooks crash in `"type":"module"` repos (BLOCKING)

**Symptom:** First session opened in the bootstrapped repo:
```
SessionStart:startup hook error — Failed with non-blocking status code:
file:///…/.claude/agentic-os/hooks/lib/io.js:1
```
`io.js:1` is `const { readFileSync } = require('node:fs');` — i.e. Node threw "require is not defined".

**Root cause:** `install-claude-hooks.js` copies CommonJS `.js` hook libs (using `require` /
`module.exports`) into `.claude/agentic-os/`, but does **not** drop a `package.json` there. Node picks
the *nearest* `package.json` to decide module type. In an **Astro / Vite / any ESM repo**, the repo
root `package.json` has `"type": "module"`, so every copied `.js` is loaded as an **ES module** and
`require` is undefined → the hook crashes on load. (It works in CommonJS-root repos and in the plugin's
own dir only because those roots default to CommonJS.)

**Fix (pick one):**
- **Simplest:** have `install-claude-hooks.js` write `.claude/agentic-os/package.json` containing
  `{ "type": "commonjs" }`. Node then scopes all `.js` under the runtime back to CommonJS regardless of
  the repo root. (One file; this is what I did manually.)
- **Alternative:** rename the runtime hook libs to `.cjs` (and update the `require()` paths +
  `hooks.json`/settings commands). More invasive.

**Manual workaround used:** added `.claude/agentic-os/package.json` = `{"type":"commonjs"}`.
Verified the SessionStart hook then exits 0 and emits context.

---

## 🟠 FIX 3 — plugin manifest fails to load on Claude Code 2.1.x (BLOCKING at install)

When installing the plugin itself (`claude plugin install agentic-os@agentic-os`), it installed but
showed **`Status: ✘ failed to load`** with two errors:

1. **Duplicate hooks:**
   ```
   Hook load failed: Duplicate hooks file detected: ./hooks/hooks.json resolves to already-loaded
   file …/hooks/hooks.json. The standard hooks/hooks.json is loaded automatically, so manifest.hooks
   should only reference additional hook files.
   ```
   → CC 2.1.x auto-loads `hooks/hooks.json`. The manifest **also** declaring `"hooks": "./hooks/hooks.json"`
   double-loads it.
   **Fix:** remove the `"hooks": "./hooks/hooks.json"` line from `.claude-plugin/plugin.json`.

2. **Dependency resolution:**
   ```
   Dependency "superpowers@agentic-os" is not installed …
   ```
   → `plugin.json` declares `"dependencies": ["superpowers"]`, which CC resolves as `superpowers@agentic-os`
   (same marketplace). But superpowers ships from the `superpowers-dev` marketplace, and that marketplace
   isn't in the plugin's cross-marketplace allow-list.
   **Fix (either):**
   - add `"superpowers-dev"` to `allowCrossMarketplaceDependenciesOn` in `.claude-plugin/marketplace.json`
     (currently only `["claude-plugins-official"]`), **and/or**
   - qualify the dependency: `"dependencies": ["superpowers@superpowers-dev"]` (or `@claude-plugins-official`
     if that's the canonical source).

   ⚠️ Confirm where superpowers canonically installs from for the team and pin the dep to that marketplace
   so it resolves on any machine.

**Manual workaround used:** patched both manifest files in the local clone; plugin then loaded
(`✔ enabled`).

---

## 🟡 FIX 4 — Astro / static-site support (QUALITY, non-blocking)

agentic-os doesn't natively recognize **Astro**, which produced two cosmetic-but-real artifacts:

- **`detect.js`** reports `frameworks: []` + `staticSite: true` (no Astro detection). Consider adding an
  Astro signal (presence of `astro` in deps / `astro.config.*`).
- **File-route URLs keep the extension** — the file-route deriver emitted routes like `/about.astro`
  and `/blog/:slug.astro` instead of `/about` and `/blog/:slug`. Astro (and most file-based routers)
  strip the page extension. The deriver should strip `.astro` (and `.md`/`.mdx`) like it does `.ts/.js`.
- **`maxDrift` false-positive on external-API sites:** a static site whose `fetch()` calls hit an
  **external** backend via `${API_BASE}` gets `feCalls drift = 100%` (calls bucket as "unmatched"
  rather than "external") → the trust gate says NOT-TRUSTED even though routes/surfaces are 0% drift and
  the map is accurate. Consider classifying template-literal URLs that begin with a base-URL variable
  (`${API_BASE}`, `${BACKEND}`, absolute `http`) as **external** so they don't count against drift.

---

## ⚠️ OPERATIONAL NOTE (not a code fix) — bootstrap must run from *inside* the target repo

The agent-driven passes (`deep-map`, `enrich-audits`) resolve file reads against the **session's cwd**.
If you run them from a *different* repo with an explicit target path, and that other repo contains a
**same-named subfolder** (e.g. `lpai-freshmonorepo/apps/saltgrass-modular/`), the agents read the wrong
(stale) copy. The deterministic bins honor the explicit target path; the agents do not.

**Guidance:** always run `/agentic-os:bootstrap-ecosystem` (and especially the deep/enrich passes) from a
Claude session opened **inside the target repo**. Optionally, `deep-select.js` could emit **absolute**
file paths into `sweep.js`/`gapfill.js` so the agent reads are cwd-independent and immune to namesake
collisions.

---

## Summary table

| # | Severity | File to change | Change |
|---|---|---|---|
| 1 | 🔴 Blocking | `skills/bootstrap-ecosystem/SKILL.md` | add a step that runs `bin/install-claude-hooks.js` |
| 2 | 🔴 Blocking | `bin/install-claude-hooks.js` | write `.claude/agentic-os/package.json` `{"type":"commonjs"}` (or use `.cjs` libs) |
| 3 | 🟠 Blocking (install) | `.claude-plugin/plugin.json` + `marketplace.json` | drop `hooks` key; fix the `superpowers` dependency/allow-list |
| 4 | 🟡 Quality | `bin/detect.js` + file-route deriver + wireup classifier | Astro detection; strip page ext from routes; treat `${API_BASE}` calls as external |
| — | ℹ️ Note | docs / `deep-select.js` | run from inside the target repo; consider absolute paths in sweep scripts |

All four were hit on a single real install (Salt-Grass-Modular, Astro 5). Fixes 1–3 are small and would
make a fresh install work end-to-end with no manual intervention.
