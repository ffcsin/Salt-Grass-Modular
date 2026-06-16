const { readStdin, buildContext, buildDeny, buildAsk, write } = require('./lib/io');
const { loadHooksConfig, isEnabled } = require('./lib/config');
const { escalate, currentRole, gateSeverity } = require('./lib/role');
const ctx = require('./bumpers/context');
const safety = require('./bumpers/safety');
const verify = require('./bumpers/verify');
const schema = require('./bumpers/schema');
const writeguard = require('./bumpers/writeguard');
const { describeBash, describeEdit, askBody } = require('../src/describe-op');

// Emit by resolved severity: block→hard deny, warn→soft context note, ask(default)→interactive popup.
function emitGate(sev, askText, plainReason) {
  if (sev === 'block') return buildDeny('PreToolUse', plainReason);
  if (sev === 'warn') return buildContext('PreToolUse', plainReason);
  return buildAsk('PreToolUse', askText);
}

function main() {
  const input = readStdin();
  if (!input || !input.tool_name) return;
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || '.';
  if (require('./lib/defer').shouldDefer(__dirname, projectDir)) return; // plugin copy defers to repo-local
  const cfg = loadHooksConfig(projectDir);
  const tool = input.tool_name, ti = input.tool_input || {};

  if (tool === 'Bash' && isEnabled(cfg, 'safetyGuardrails')) {
    const d = safety.checkBash(ti.command || '');
    if (d && d.block && !process.env.AGENTIC_OS_OVERRIDE) {
      const sev = gateSeverity(undefined, currentRole(cfg), cfg); // ask by default; owner can set block
      write(emitGate(sev, askBody(describeBash(ti.command || ''), { command: ti.command, reason: d.reason }), d.reason)); return;
    }
  }
  // Pre-push preflight gate — make the agent run /agentic-os:preflight LOCALLY before the code hits GH/GL.
  if (tool === 'Bash' && isEnabled(cfg, 'prePushPreflight') !== false && !process.env.AGENTIC_OS_OVERRIDE) {
    const g = require('./bumpers/process').gitPushGate(projectDir, ti.command || '');
    if (g.triggered) {
      const sev = gateSeverity(cfg.enforcePrePush, currentRole(cfg), cfg);
      write(emitGate(sev, g.reason, g.reason)); return;
    }
  }
  if (tool === 'Edit' || tool === 'Write') {
    if (isEnabled(cfg, 'readBeforeEdit') !== false && cfg.enforceReadBeforeEdit && !process.env.AGENTIC_OS_OVERRIDE) {
      const g = verify.readBeforeEditGate(projectDir, ti.file_path || '');
      if (g.triggered) {
        const sev = gateSeverity(cfg.enforceReadBeforeEdit, currentRole(cfg), cfg);
        write(emitGate(sev, askBody(describeEdit('read-before-edit', ti.file_path || ''), { reason: g.reason }), g.reason)); return;
      }
    }
    // TDD gate (ask-default) — creating NEW source with exports + no sibling test → write the failing
    // test first. Only on Write to a not-yet-existing file, so it never nags on edits to existing code.
    if (tool === 'Write' && isEnabled(cfg, 'tddGate') !== false && !process.env.AGENTIC_OS_OVERRIDE) {
      const isNew = !require('node:fs').existsSync(ti.file_path || '');
      const g = verify.tddGate(projectDir, ti.file_path || '', isNew, ti.content || '');
      if (g.triggered) {
        const sev = gateSeverity(cfg.tddEnforce, currentRole(cfg), cfg);
        write(emitGate(sev, askBody(describeEdit('tdd', ti.file_path || ''), { reason: g.reason }), g.reason)); return;
      }
    }
    // Write-time secret guard — ask by default; owner can pin to block (or set enforcementMode:'block').
    if (isEnabled(cfg, 'secretGuard') !== false && !process.env.AGENTIC_OS_OVERRIDE) {
      const content = writeguard.newContentOf(tool, ti);
      const sb = writeguard.secretBlock(projectDir, content);
      if (sb) {
        const sev = gateSeverity(cfg.secretEnforce, currentRole(cfg), cfg);
        write(emitGate(sev, askBody(describeEdit('secret', ti.file_path || ''), { reason: sb }), sb)); return;
      }
    }
    const parts = [];
    // dep-guard only for CODE files — an import in a markdown example is documentation, not a dependency.
    if (isEnabled(cfg, 'depGuard') !== false && /\.(ts|tsx|js|jsx|cjs|mjs)$/.test(String(ti.file_path || ''))) parts.push(writeguard.depWarn(projectDir, writeguard.newContentOf(tool, ti)));
    if (isEnabled(cfg, 'staleContext') !== false) { try { parts.push(require('../src/stale-context').staleNudge(projectDir)); } catch {} }
    if (isEnabled(cfg, 'preEditContext')) parts.push(ctx.preEditContext(projectDir, ti.file_path || '', cfg.preEditCharCap));
    if (tool === 'Edit' && isEnabled(cfg, 'contextPack')) { try { const cp = require('../src/context-pack').buildContextPack(projectDir, ti.file_path || ''); if (cp.importers.length) parts.push(`[agentic-os] Blast radius: ${cp.importers.length} file(s) import \`${cp.target}\` — ${cp.importers.slice(0,6).join(', ')}. Check them if you change its signature.`); } catch {} }
    if (isEnabled(cfg, 'blastRadius')) parts.push(verify.blastRadius(cfg, ti.file_path || '', projectDir));
    if (tool === 'Write' && isEnabled(cfg, 'newFileNudge')) { parts.push(verify.newFileNudge(projectDir, ti.file_path || '')); try { parts.push(ctx.newFileGap(projectDir, ti.file_path || '', require('node:fs').existsSync(ti.file_path || ''))); } catch {} }
    if (isEnabled(cfg, 'schemaFanout') !== false) parts.push(schema.schemaFanoutNudge(projectDir, ti.file_path || ''));
    write(buildContext('PreToolUse', parts.filter(Boolean).join('\n\n')));
  }
}
try { main(); } catch { /* fail-soft */ }
