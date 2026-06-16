#!/usr/bin/env node
// CLI access to the code knowledge graph (for diagnose-bug + ad-hoc use, no MCP needed).
// Usage:
//   node bin/query-graph.js <target> trace <nodeId> [depth]
//   node bin/query-graph.js <target> impact <fileOrNodeId> [depth]
//   node bin/query-graph.js <target> orphans
//   node bin/query-graph.js <target> find <substring> [type]
const fs = require('node:fs');
const path = require('node:path');
const { queryGraph, traceCallPath, impact, findOrphans, indexEdges } = require('../src/graph/query');

const root = path.resolve(process.argv[2] || '.');
const op = process.argv[3];
const graph = JSON.parse(fs.readFileSync(path.join(root, '.ecosystem', 'graph.json'), 'utf8'));
const idx = indexEdges(graph);
const norm = (id) => (graph.nodes.find((n) => n.id === id) ? id : `file:${id}`); // accept a bare path

let out;
if (op === 'trace') out = traceCallPath(graph, norm(process.argv[4]), { idx, depth: Number(process.argv[5]) || 4 }).map((p) => p.join(' '));
else if (op === 'impact') out = impact(graph, norm(process.argv[4]), { idx, depth: Number(process.argv[5]) || 3 });
else if (op === 'orphans') out = findOrphans(graph, { idx }).map((n) => n.path);
else if (op === 'find') out = queryGraph(graph, { match: process.argv[4], type: process.argv[5] }).map((n) => n.id);
else { console.error('ops: trace | impact | orphans | find'); process.exit(2); }
console.log(JSON.stringify(out, null, 2));
