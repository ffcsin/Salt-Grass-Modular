// src/graph/query.js
// Query primitives over the knowledge graph — the operations agents call instead of grep+read.
function indexEdges(graph) {
  const out = new Map(); // from -> [edge]
  const incoming = new Map(); // to -> [edge]
  for (const e of graph.edges) {
    (out.get(e.from) || out.set(e.from, []).get(e.from)).push(e);
    (incoming.get(e.to) || incoming.set(e.to, []).get(e.to)).push(e);
  }
  return { out, incoming };
}

// Filter nodes (by type and/or id/path substring).
function queryGraph(graph, { type, match } = {}) {
  let ns = graph.nodes;
  if (type) ns = ns.filter((n) => n.type === type);
  if (match) { const m = String(match).toLowerCase(); ns = ns.filter((n) => (n.id + ' ' + (n.path || '')).toLowerCase().includes(m)); }
  return ns;
}

// BFS outward from a node, following edges, up to `depth`. Returns the reached paths.
function traceCallPath(graph, startId, { depth = 4, idx } = {}) {
  const { out } = idx || indexEdges(graph);
  const seen = new Set([startId]);
  const paths = [];
  let frontier = [[startId]];
  for (let d = 0; d < depth && frontier.length; d++) {
    const next = [];
    for (const p of frontier) {
      const node = p[p.length - 1];
      for (const e of out.get(node) || []) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        const np = [...p, `${e.type}->${e.to}`];
        paths.push(np);
        next.push([...p, e.to]);
      }
    }
    frontier = next;
  }
  return paths;
}

// Impact of changing a file: which nodes depend ON it (incoming edges, transitively) — the things
// that break if it changes. For a file that EXPOSES routes, this surfaces every CALLER.
function impact(graph, nodeId, { depth = 3, idx } = {}) {
  const { incoming, out } = idx || indexEdges(graph);
  // a file node's routes are its "surface"; collect them, then who calls them.
  const surface = new Set([nodeId]);
  for (const e of out.get(nodeId) || []) if (e.type === 'EXPOSES') surface.add(e.to);
  const dependents = new Set();
  let frontier = [...surface];
  for (let d = 0; d < depth && frontier.length; d++) {
    const next = [];
    for (const id of frontier) for (const e of incoming.get(id) || []) {
      if (!dependents.has(e.from) && e.from !== nodeId) { dependents.add(e.from); next.push(e.from); }
    }
    frontier = next;
  }
  return [...dependents];
}

// Orphan routes: route nodes with NO incoming CALLS edge.
function findOrphans(graph, { idx } = {}) {
  const { incoming } = idx || indexEdges(graph);
  return graph.nodes.filter((n) => n.type === 'route' && !(incoming.get(n.id) || []).some((e) => e.type === 'CALLS'));
}

module.exports = { indexEdges, queryGraph, traceCallPath, impact, findOrphans };
