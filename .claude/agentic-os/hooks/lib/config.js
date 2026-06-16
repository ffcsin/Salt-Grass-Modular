const { readFileSync } = require('node:fs');
const path = require('node:path');
const DEFAULTS = {
  enable: { preEditContext: true, promptRouter: true, postEditNudge: true, sessionSummary: true,
    safetyGuardrails: true, readTracker: true, blastRadius: true, newFileNudge: true, stopVerify: true, stopRemapNet: true, auditTrail: true, errorCheck: true,
    prePushPreflight: true, ciAutoMaintain: true },
  preEditCharCap: 4000, highFanoutFiles: [], role: 'default',
  // enforcementMode is the single dial (ask|block|warn), default 'ask'. The enforce* keys just ENABLE
  // the gate (truthy); the actual severity resolves through gateSeverity → enforcementMode, so an owner
  // flips ONE value to 'block' to restore hard-deny. A per-gate string ('block'/'warn') still overrides.
  enforcementMode: 'ask',
  enforceReadBeforeEdit: true, enforceVerifyBeforeDone: true,
};
function loadHooksConfig(projectDir) {
  let cfg = {};
  try { cfg = JSON.parse(readFileSync(path.join(projectDir, '.ecosystem', 'hooks-config.json'), 'utf8')); } catch {}
  return { ...DEFAULTS, ...cfg, enable: { ...DEFAULTS.enable, ...(cfg.enable || {}) } };
}
function envKnob(name) {
  return 'AGENTIC_OS_NO_' + name.replace(/([A-Z])/g, '_$1').toUpperCase();
}
function isEnabled(cfg, name) {
  if (process.env.AGENTIC_OS_NO_HOOKS) return false;
  if (process.env[envKnob(name)]) return false;
  return cfg.enable[name] !== false;
}
module.exports = { loadHooksConfig, isEnabled, DEFAULTS };
