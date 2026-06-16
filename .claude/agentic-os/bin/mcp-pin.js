#!/usr/bin/env node
'use strict';
// MCP tool-integrity pinning. Pin the current MCP server configs (+ optional tools manifest), then
// check for rug-pulls / tool-poisoning on later runs.
//   node bin/mcp-pin.js <target> pin                 # snapshot current .mcp.json servers
//   node bin/mcp-pin.js <target> check               # diff live vs pins (exit 1 on findings)
//   node bin/mcp-pin.js <target> pin --tools t.json  # also pin a tools manifest [{name,description,inputSchema}]
const fs = require('node:fs'); const path = require('node:path');
const M = require('../src/mcp-pin');
const root = path.resolve(process.argv[2] || '.');
const cmd = process.argv[3] || 'check';
const ti = process.argv.indexOf('--tools'); let tools = [];
if (ti >= 0) { try { tools = JSON.parse(fs.readFileSync(process.argv[ti + 1], 'utf8')); } catch {} }
const servers = M.loadServers(root);
const live = M.buildPins({ servers, tools });
if (cmd === 'pin') { console.log('pinned ' + M.savePins(root, live)); }
else {
  const d = M.checkPins(M.loadPins(root), live);
  if (d.unpinned) { console.log('no pins yet — run `pin` first'); process.exit(0); }
  const lines = ['# MCP integrity check', ''];
  if (d.changedServers.length) lines.push(`- ⚠ CHANGED servers (rug-pull?): ${d.changedServers.join(', ')}`);
  if (d.newServers.length) lines.push(`- new servers: ${d.newServers.join(', ')}`);
  if (d.changedTools.length) lines.push(`- ⚠ CHANGED tool schema/description: ${d.changedTools.join(', ')}`);
  if (d.newTools.length) lines.push(`- new tools: ${d.newTools.join(', ')}`);
  if (d.poisoned.length) for (const p of d.poisoned) lines.push(`- ⚠ POISONED tool \`${p.tool}\` — description contains [${p.flags.join(', ')}]`);
  if (lines.length === 2) lines.push('- ✅ all pinned servers/tools unchanged');
  const dir = path.join(root, '.ecosystem', 'reports'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mcp-integrity.md'), lines.join('\n') + '\n');
  console.log(JSON.stringify({ findings: M.hasFindings(d) }));
  process.exit(M.hasFindings(d) ? 1 : 0);
}
