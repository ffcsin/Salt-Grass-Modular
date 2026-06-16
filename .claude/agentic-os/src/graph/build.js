// src/graph/build.js
// Build a typed code knowledge graph from the deep-map spine (no extra parsing needed — the deep
// map already has connectionsOut/exposesEndpoints/wireup). Nodes: file, route, external. Edges:
// EXPOSES (file→route), CALLS (file→route, from the FE↔BE wireup), HTTP_CALL (file→external host),
// IMPORTS (file→file, from non-http connections that name a local module). This is the structure
// agents traverse (trace_call_path / impact) instead of grepping — 10× cheaper context per research.
const { normalizeRoute, normalizeUrl } = require('../../lib/url-normalize');

const pathOf = (id) => String(id || '').replace(/^\s*(GET|POST|PUT|DELETE|PATCH|ANY)\s+/i, '');

function buildGraph(deepMap) {
  const nodes = new Map();
  const edges = [];
  const addNode = (id, type, extra) => { if (!nodes.has(id)) nodes.set(id, { id, type, ...extra }); return nodes.get(id); };
  const routeId = (routePath) => `route:${normalizeRoute(routePath)}`;

  for (const f of deepMap.files || []) {
    const fileId = `file:${f.file}`;
    addNode(fileId, 'file', { path: f.file, kind: f.kind });
    for (const e of f.exposesEndpoints || []) {
      if (e.type !== 'route') continue;
      const rid = routeId(pathOf(e.id));
      const n = addNode(rid, 'route', { path: pathOf(e.id), methods: [], guards: e.guards || [], definedIn: f.file, line: e.line });
      const m = String(e.method || 'ANY').toUpperCase();
      if (!n.methods.includes(m)) n.methods.push(m);
      edges.push({ from: fileId, to: rid, type: 'EXPOSES' });
    }
  }

  // CALLS + HTTP_CALL directly from each file's outbound http-calls (denser + more complete than the
  // wireup's matched subset). Internal calls that resolve to a known route → CALLS; external → the
  // host; internal calls with no matching route → CALLS-UNRESOLVED (a likely orphan/typo, kept so the
  // edge isn't silently dropped).
  for (const f of deepMap.files || []) {
    const fileId = `file:${f.file}`;
    for (const c of f.connectionsOut || []) {
      if (c.type !== 'http-call') continue;
      const norm = normalizeUrl(c.target || '');
      if (norm.external && norm.externalHost) {
        const ext = `ext:${norm.externalHost}`;
        addNode(ext, 'external', { host: norm.externalHost });
        edges.push({ from: fileId, to: ext, type: 'HTTP_CALL', line: c.line });
      } else if (!norm.external) {
        const rid = `route:${norm.paramKey}`;
        edges.push({ from: fileId, to: rid, type: nodes.has(rid) ? 'CALLS' : 'CALLS_UNRESOLVED', method: c.method, line: c.line, target: c.target });
      }
    }
    // Async topology: queue/event connections → a queue node + ENQUEUES edge (research §5: model the
    // async flow that the synchronous call graph misses).
    for (const c of f.connectionsOut || []) {
      if (c.type !== 'queue' && c.type !== 'event') continue;
      const qid = `queue:${String(c.target || '').slice(0, 80)}`;
      addNode(qid, 'queue', { name: c.target });
      edges.push({ from: fileId, to: qid, type: 'ENQUEUES', line: c.line, detail: c.detail });
    }
  }

  return { nodes: [...nodes.values()], edges };
}

// Convenience: attach counts.
function withStats(graph) {
  const s = { file: 0, route: 0, external: 0 };
  for (const n of graph.nodes) s[n.type] = (s[n.type] || 0) + 1;
  const e = {};
  for (const ed of graph.edges) e[ed.type] = (e[ed.type] || 0) + 1;
  graph.stats = { nodes: graph.nodes.length, edges: graph.edges.length, byNodeType: s, byEdgeType: e };
  return graph;
}

module.exports = { buildGraph, withStats };
