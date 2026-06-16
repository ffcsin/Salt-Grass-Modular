// Enforcement mode + role strictness. The single owner-facing dial is `enforcementMode`:
//   'ask'  (DEFAULT) → interactive permission popup on PreToolUse; soft self-correct nudge on Stop.
//   'block'          → hard deny. OWNER OPT-IN ONLY.
//   'warn'           → log/context only, never interrupts.
// Resolution precedence: env AGENTIC_OS_ENFORCEMENT > profile.enforcementMode > config.enforcementMode > 'ask'.
// Role is an ESCALATOR only (never silently downgrades safety): junior/contractor are pinned to a 'block'
// safety floor; senior/lead may relax an owner 'block' to 'warn'. The baseline for the default/unknown
// role is 'ask' — so nothing hard-blocks unless the owner deliberately turns it on.
const { loadProfile } = require('./profile');
const TIGHTEN = new Set(['junior', 'contractor']);
const RELAX = new Set(['senior', 'lead']);
const MODES = new Set(['ask', 'block', 'warn']);

function currentRole(cfg) {
  const p = loadProfile();
  if (p && !p._missing && p.role) return p.role;
  return (cfg && cfg.role) || 'default';
}

function enforcementMode(cfg) {
  const env = process.env.AGENTIC_OS_ENFORCEMENT;
  if (env && MODES.has(env)) return env;
  try { const p = loadProfile(); if (p && !p._missing && MODES.has(p.enforcementMode)) return p.enforcementMode; } catch {}
  if (cfg && MODES.has(cfg.enforcementMode)) return cfg.enforcementMode;
  return 'ask';
}

// warn→block only for tightened roles (legacy escalate; never downgrades a block).
function escalate(severity, role) {
  if (severity === 'warn' && TIGHTEN.has(role)) return 'block';
  return severity;
}

// Resolve a gate's severity. `perGate` is an optional per-gate override ('block'/'warn'/'ask'); anything
// else (true/undefined) falls to the global enforcementMode. Returns 'ask' | 'block' | 'warn'.
function gateSeverity(perGate, role, cfg) {
  if (TIGHTEN.has(role)) return 'block';                       // safety floor for untrusted roles
  let mode = MODES.has(perGate) ? perGate : enforcementMode(cfg);
  if (RELAX.has(role) && mode === 'block') mode = 'warn';      // trusted seniors can relax an owner block
  return mode;
}

module.exports = { escalate, currentRole, gateSeverity, enforcementMode, MODES };
