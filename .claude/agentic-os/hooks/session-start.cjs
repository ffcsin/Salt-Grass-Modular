const fs = require('node:fs');
const path = require('node:path');
const { readStdin } = require('./lib/io');
const { loadHooksConfig, isEnabled } = require('./lib/config');
const { profileConfigured, profileGuidance, identityNote } = require('./lib/profile');
const ctx = require('./bumpers/context');
function main() {
  const input = readStdin() || {};
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || '.';
  if (require('./lib/defer').shouldDefer(__dirname, projectDir)) return; // plugin copy defers to repo-local
  const cfg = loadHooksConfig(projectDir);
  // Reset SESSION-scoped trackers so they don't go stale across sessions (review C1): .session-reads
  // (read-before-edit would otherwise count a file you read last week) + .session-edits + the
  // self-critique circuit-breaker counter. Keyed by nothing — a new SessionStart IS a new session.
  try {
    const fs2 = require('node:fs'); const p2 = require('node:path');
    for (const f of ['.session-reads.json', '.session-edits.json', '.self-critique-blocks.json']) {
      try { fs2.unlinkSync(p2.join(projectDir, '.ecosystem', f)); } catch {}
    }
  } catch {}
  const parts = [];
  // Re-anchor the mandated workflow every session (CLAUDE.md compresses mid-conversation). This repo
  // requires superpowers (brainstorm → TDD → verification) + ecosystem-first + trust-but-verify.
  if (fs.existsSync(path.join(projectDir, '.ecosystem')) && isEnabled(cfg, 'mandateReminder') !== false) {
    parts.push('[agentic-os] This repo runs the mandated agentic workflow (CLAUDE.md): superpowers (brainstorm→TDD→verification-before-completion) + read the area audit BEFORE editing + TRUST-BUT-VERIFY (open the cited file:line; the map can miss dynamic/non-REST routes & global guards). If the `superpowers` plugin is not installed, install it before non-trivial work. To persist a durable discovery so the next session knows it, write `LEARNING(gotcha): …` (or `LEARNING(user): …` for a fact about your collaborator) anywhere in your reply — it is auto-saved at session end (repo learnings / global profile).');
  }
  if (isEnabled(cfg, 'sessionSummary')) parts.push(ctx.sessionSummary(projectDir));
  if (!profileConfigured()) { // missing OR a bootstrap-scaffolded placeholder → still onboard
    // Auto-prompt: hooks can't open Claude's UI themselves, so DIRECT the agent to run the interview
    // via AskUserQuestion at the start of the turn (default-on; one-time — answering or declining both
    // write the profile so it never nags again). The save path is the always-present profile lib (works
    // in plugin + repo-local). Disable: hooks-config enable.profilePrompt=false.
    if (isEnabled(cfg, 'profilePrompt') !== false) {
      const libPath = path.join(__dirname, 'lib', 'profile.js').replace(/\\/g, '/');
      parts.push([
        '[agentic-os] FIRST ACTION — no user profile exists for whoever is working in this repo. Before substantive work, run a quick onboarding using the **AskUserQuestion** tool (Claude\'s UI) — ask in ONE AskUserQuestion call (multiple questions):',
        '  1. Name + role/title → role maps to: lead | senior | mid | junior | contractor (drives how strict the safety gates are)',
        '  2. Git email + commit attribution → "solo" (commits are YOURS only, no AI co-author trailer) | "co-authored" (keep the AI trailer, transparent). The profile becomes the identity source so commits are authored as the user.',
        '  3. Communication style → technical (full jargon) | simple (dumbed-down) | both (technical then "explain like I\'m seven")',
        '  4. Vibe → professional | casual-funny; (optional) strongest area + where they want extra care.',
        `Then SAVE: node -e "require('${libPath}').saveProfile({name:'<name>',role:'<role>',email:'<email>',attribution:'<solo|co-authored>',preferences:{communicationStyle:'<cs>',vibe:'<vibe>'}})"  then align git: node "${path.join(__dirname, '..', '..', 'bin', 'git-identity.js').replace(/\\\\/g, '/')}" . (plugin) or skip if repo-local.`,
        'If they decline / say skip: node -e "require(\'' + libPath + "').saveProfile({role:'default',declined:true})\" so this never asks again. NEVER put secrets in the profile.",
      ].join('\n'));
    }
  } else if (isEnabled(cfg, 'profileGuidance') !== false) { parts.push(profileGuidance()); if (isEnabled(cfg, 'identityNote') !== false) parts.push(identityNote(projectDir)); }
  const out = parts.filter(Boolean).join('\n\n');
  if (out) process.stdout.write(out);
}
try { main(); } catch { /* fail-soft */ }
