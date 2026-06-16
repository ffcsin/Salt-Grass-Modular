// src/adr.js
// ADR (Architecture Decision Record) scaffolding — the "decisions/why" layer (Grok's Decisions
// Agent; research: ADRs are re-emerging precisely because agents have no cross-session memory of WHY
// a choice was made). The bootstrap scaffolds the dir + template; the `adr-capture` skill drafts
// real ADRs by inferring reasoning from the deep-map + git history.
function adrTemplate() {
  return `# ADR NNNN: <short decision title>

- **Status:** proposed | accepted | superseded by ADR-XXXX
- **Date:** YYYY-MM-DD
- **Deciders:** <who>

## Context
<The forces at play: the problem, constraints, and what made a decision necessary.>

## Decision
<What we decided to do.>

## Consequences
<What becomes easier or harder. Trade-offs accepted. Follow-ups.>

## Alternatives considered
<Other options and why they were not chosen. "Reasoning not found in code/history" is a valid entry.>
`;
}

function adrReadme() {
  return `# Architecture Decision Records

Each ADR captures the **why** behind a significant choice — the context that evaporates between
sessions and that flat docs omit. Number them sequentially (\`0001-...\`, \`0002-...\`).

- New decision → copy \`0000-template.md\` to \`NNNN-<slug>.md\` and fill it in.
- Let an agent draft one → run the \`adr-capture\` skill (it infers reasoning from the deep-map +
  git history and flags "reasoning not found" where it can't).
- Keep them immutable — supersede with a new ADR rather than rewriting history.
`;
}

module.exports = { adrTemplate, adrReadme };
