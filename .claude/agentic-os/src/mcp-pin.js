'use strict';
// MCP tool-integrity pinning (rug-pull / tool-poisoning defense). MCP tool descriptions are fed to
// the model as trusted instructions; a server can ship a benign description, get approved, then swap
// in a malicious one. This fingerprints each tool's name+description+schema (and each server's
// command/url) into a pin file, then diffs the live set on later runs: changed schema/description
// (rug-pull), new tools, or descriptions containing injection-like text (poisoning). Zero deps.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { detectInjection } = require('./diagnostics/untrusted-content');

const PIN_FILE = (root) => path.join(root, '.ecosystem', 'mcp-pins.json');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 24);

// Fingerprint a tool definition (order-stable JSON of the salient fields).
function fingerprintTool(tool) {
  const salient = { name: tool.name, description: tool.description || '', schema: tool.inputSchema || tool.input_schema || {} };
  return sha(JSON.stringify(salient, Object.keys(salient).sort()));
}

// Fingerprint a server config from .mcp.json (command+args or url — catches a server-swap).
function fingerprintServer(name, def) {
  const salient = { name, command: def.command || '', args: def.args || [], url: def.url || def.httpUrl || '' };
  return sha(JSON.stringify(salient));
}

// Build a pin set from servers (.mcp.json mcpServers) and/or a tools manifest.
function buildPins({ servers = {}, tools = [] } = {}) {
  const pins = { servers: {}, tools: {} };
  for (const [name, def] of Object.entries(servers)) pins.servers[name] = fingerprintServer(name, def);
  for (const t of tools) pins.tools[t.name] = { fp: fingerprintTool(t), poison: detectInjection(t.description || '') };
  return pins;
}

function loadServers(root) {
  for (const f of ['.mcp.json', path.join('.claude', 'mcp.json')]) {
    try { const j = JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); return j.mcpServers || j.servers || {}; } catch {}
  }
  return {};
}

function savePins(root, pins) { const f = PIN_FILE(root); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(pins, null, 2) + '\n'); return f; }
function loadPins(root) { try { return JSON.parse(fs.readFileSync(PIN_FILE(root), 'utf8')); } catch { return null; } }

// Diff live state vs pins. Returns {changedServers, newServers, changedTools, newTools, poisoned}.
function checkPins(pinned, live) {
  const out = { changedServers: [], newServers: [], changedTools: [], newTools: [], poisoned: [] };
  if (!pinned) return { ...out, unpinned: true };
  for (const [name, fp] of Object.entries(live.servers || {})) {
    if (!(name in pinned.servers)) out.newServers.push(name);
    else if (pinned.servers[name] !== fp) out.changedServers.push(name);
  }
  for (const [name, rec] of Object.entries(live.tools || {})) {
    if (!(name in pinned.tools)) out.newTools.push(name);
    else if (pinned.tools[name].fp !== rec.fp) out.changedTools.push(name);
    if (rec.poison && rec.poison.length) out.poisoned.push({ tool: name, flags: rec.poison });
  }
  return out;
}

function hasFindings(d) { return !!(d && (d.changedServers.length || d.newServers.length || d.changedTools.length || d.newTools.length || d.poisoned.length)); }

module.exports = { fingerprintTool, fingerprintServer, buildPins, loadServers, savePins, loadPins, checkPins, hasFindings, PIN_FILE };
