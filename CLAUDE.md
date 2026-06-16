<!-- agentic-os:begin (generated — do not edit inside this block) -->
## Agentic workflow (managed by agentic-os)

_24 mapped areas. Per-area docs live in `.ecosystem/audits/<area>.md` and are auto-loaded before edits; full index: `.ecosystem/ECOSYSTEM.md`._

**This repo requires the `superpowers` plugin** (brainstorm → TDD → verification-before-completion). If it is not installed, install it before non-trivial work.

> 🛑 **NO HALF-ASS.** Never ship anything deliberately shallow, stubbed, or "good enough for now." Don't leave a capability built-but-unrun; never narrate a partial result as complete. A fast/cheap layer is only OK as the scaffold UNDER the full layer — and the full layer must get delivered.

1. **Read the area audit BEFORE editing** — `.ecosystem/audits/<area>.md` (routes, guards, params, gaps, intent). The PreToolUse hook auto-loads it; don't skip it.
2. **Brainstorm → TDD → Verify** — `superpowers:brainstorming` for non-trivial work, `superpowers:test-driven-development` (failing test first — a hook ASKS for the test when you create new code without one), `superpowers:verification-before-completion` before claiming done (a hook blocks a "done" claim with no test run).
3. **TRUST BUT VERIFY (non-negotiable)** — the docs are a MAP, the code is the territory. Structural sections (routes/guards/params) are extracted from shipped code but CAN miss dynamic/non-REST routes, global guards (a "no-auth" route may be globally guarded), and non-TS backends; the Intent/Behavior/Gap prose is agent-written and CAN drift. Open the cited `file:line`, confirm against the real handler, and if they disagree, **trust the code** — then note the drift. Never edit or diagnose from the doc alone.
4. **Reference catalogs** — crons/webhooks/collections/env-vars/tier-gates live in `.ecosystem/reference/`.
5. **Throttle agent fan-outs** — when running a Workflow / parallel agents, process in WAVES of ≤5 (sequential batches), never 100-at-once. A wide burst trips Anthropic's server-side rate-limit ("temporarily limiting requests — not your usage limit") and ALL agents fail at once. Hooks can't pace the API; this is a self-discipline rule.
6. **Persist what you learn** — to save a durable discovery for the next session, write `LEARNING(gotcha): …` (or `convention`/`fix`/`pattern`/`decision`/`intent`) anywhere in your reply; it is auto-captured into `.ecosystem/learnings.jsonl` at session end and re-surfaced before edits in that area. Use `LEARNING(user): …` for a durable fact about your collaborator — that one persists to the GLOBAL profile and is known in every repo with this system. New fix()/feat() commits are captured automatically.

_The structural map (routes/guards/params/orphans/catalogs) auto-refreshes on Stop when files change (free, no agents); the semantic audit enrichment refreshes at `/agentic-os:preflight`. CI configs self-maintain on tooling changes._
<!-- agentic-os:end -->

## Project notes

_Your repo-specific notes go here (never touched by agentic-os)._
