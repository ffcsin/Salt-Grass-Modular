#!/usr/bin/env node
// Build the code knowledge graph from the deep-map → .ecosystem/graph.json.
// Usage: node bin/build-graph.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { buildGraph, withStats } = require('../src/graph/build');

const root = path.resolve(process.argv[2] || '.');
const eco = path.join(root, '.ecosystem');
const dm = JSON.parse(fs.readFileSync(path.join(eco, 'deep-map.json'), 'utf8'));
const graph = withStats(buildGraph(dm));
fs.writeFileSync(path.join(eco, 'graph.json'), JSON.stringify(graph, null, 2) + '\n');

// Register the graph MCP server in the target's .mcp.json (merge, never clobber other servers).
const serverPath = path.join(__dirname, '..', 'mcp', 'graph-server.js');
const mcpPath = path.join(root, '.mcp.json');
let mcp = { mcpServers: {} };
try { mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8')); mcp.mcpServers = mcp.mcpServers || {}; } catch {}
mcp.mcpServers['agentic-os-graph'] = { command: 'node', args: [serverPath, root] };
fs.writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + '\n');

console.log(JSON.stringify({ ...graph.stats, mcpRegistered: true }));
