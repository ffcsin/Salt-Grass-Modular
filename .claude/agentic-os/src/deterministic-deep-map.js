'use strict';
// Build a deep-map.json DETERMINISTICALLY (no agents) from the AST extractor + FE call patterns.
// The agentic deep-extract adds semantic prose/intent on top, but the STRUCTURAL layer the
// security/param/tenant/graph diagnostics need — routes + guards + params + FE http-calls — is fully
// deterministic from the TypeScript compiler API. This is what lets the full RBAC/param/tenant/graph
// analysis run on every repo, every time, in one command.
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../lib/walk');
const { available, extractTsRoutes } = require('./ast/ts-extract');
const modern = require('./extract/modern-ts');

const FE_CALL = [
  /(?:authFetch|apiFetch|fetch)\(\s*[`'"]([^`'"]+)/g,
  /axios\.(?:get|post|put|delete|patch)\(\s*[`'"]([^`'"]+)/g,
];
const lineOf = (content, idx) => content.slice(0, idx).split('\n').length;

function feCallsIn(content, file) {
  const out = [];
  for (const re of FE_CALL) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(content)) !== null) {
      let url = m[1];
      // Template-literal URLs (`${apiUrl}/api/x`) — strip the leading expr so the path matches a route.
      if (url.startsWith('${') || url.startsWith('`')) { const n = modern.normalizeTemplateUrl(url.replace(/^`/, '')); if (!n) continue; url = n; }
      if (!/^https?:\/\//.test(url) && !url.startsWith('/')) continue; // only real endpoints
      const methodM = content.slice(m.index, m.index + 400).match(/method:\s*['"`]([A-Za-z]+)/);
      out.push({ type: 'http-call', target: url, method: (methodM ? methodM[1] : 'GET').toUpperCase(), params: { body: [], query: [] }, line: lineOf(content, m.index) });
    }
  }
  // FE → tRPC procedure calls (trpc.ns.proc.useQuery/useMutation) → target `trpc:ns.proc`.
  for (const c of modern.trpcFeCallsIn(content)) out.push(c);
  return out;
}

function buildDeterministicDeepMap(root, opts = {}) {
  const tsOk = available();
  const files = [];
  let beFiles = []; try { beFiles = walk(root, { include: ['.ts', '.js', '.tsx', '.jsx'] }); } catch {}
  beFiles = beFiles.filter((f) => !/\.(test|spec)\.[tj]sx?$|\.d\.ts$/.test(f));

  // Pre-pass: tRPC mount edges (parentRouter → key → childRouter) may span files — the appRouter
  // composition lives in router.ts while nested mounts (briefRouter holding departmentsRouter) live in
  // the sub-router's own file. Collect edges globally, then resolve each router var to its DOTTED
  // client namespace (brief.departments). Unmounted routers fall back to a camel-strip guess so a
  // dynamically-composed router's procedures still map somewhere plausible.
  const cache = new Map();
  const read = (abs) => { if (cache.has(abs)) return cache.get(abs); let c = ''; try { c = fs.readFileSync(abs, 'utf8'); } catch {} cache.set(abs, c); return c; };
  const mounts = [];
  for (const abs of beFiles) {
    const c = read(abs);
    if (/=\s*router\s*\(\s*\{/.test(c) && /Router\b/.test(c)) mounts.push(...modern.trpcMountsIn(c));
  }
  const nsResolve = modern.resolveRouterNamespaces(mounts);
  const nsOf = (routerVar) => (routerVar ? nsResolve(routerVar) || routerVar.replace(/Router$/, '').replace(/^[A-Z]/, (x) => x.toLowerCase()) : null);

  let routeCount = 0, callCount = 0;
  for (const abs of beFiles) {
    const content = read(abs); if (!content) continue;
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    const isTs = /\.tsx?$/.test(abs);
    const exposes = [];
    // NestJS decorators (AST)
    if (tsOk && isTs && /@(Get|Post|Put|Delete|Patch|All)\(/.test(content)) {
      let routes = []; try { routes = extractTsRoutes(content, abs); } catch {}
      for (const r of routes) {
        exposes.push({ type: 'route', id: `${r.method} ${r.route}`, method: r.method, route: r.route, guards: r.guards || [], params: r.params || { query: [], body: [], path: [] }, line: r.line, handler: r.handler });
        routeCount++;
      }
    }
    // Hono routes (app.get("/path", ...))
    for (const r of modern.honoRoutesIn(content)) {
      exposes.push({ type: 'route', id: `${r.method} ${r.route}`, method: r.method, route: r.route, guards: r.guards, params: r.params, line: r.line, handler: r.handler });
      routeCount++;
    }
    // tRPC procedures as routes (id `trpc:ns.proc`) — namespace resolved from the global appRouter map.
    for (const p of modern.trpcProceduresIn(content)) {
      const ns = nsOf(p.routerVar); if (!ns) continue;
      const route = `trpc:${ns}.${p.name}`;
      exposes.push({ type: 'route', id: `${p.method} ${route}`, method: p.method, route, guards: p.guards, params: { query: [], body: [], path: [] }, line: p.line, handler: p.name, transport: 'trpc' });
      routeCount++;
    }
    const conns = feCallsIn(content, rel);
    callCount += conns.length;
    if (exposes.length || conns.length) files.push({ file: rel, kind: exposes.length ? 'backend' : 'frontend', exposesEndpoints: exposes, connectionsOut: conns, findings: [] });
  }
  return { version: 1, deterministic: true, generatedAt: opts.now || '', files, totals: { files: files.length, routes: routeCount, httpCalls: callCount } };
}

function writeDeterministicDeepMap(root, opts = {}) {
  const dm = buildDeterministicDeepMap(root, opts);
  const f = path.join(root, '.ecosystem', 'deep-map.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(dm) + '\n');
  return dm.totals;
}

// Union the deep-map's routes + FE calls into a pattern-extracted structural rawMap (in place).
// The AST/modern-TS extractors see what per-file regex can't (NestJS decorators, tRPC cross-file
// namespaces, Hono app.on mounts, trpc.ns.proc FE hooks) — without this union, the structural map,
// wireup, orphans, and drift all under-report on those stacks (a Hono+tRPC monorepo showed routes:12
// when 300 exist). Routes dedupe on the WIRE key (method + normalized path; trpc: ids verbatim) so a
// route found by both sources never doubles; calls dedupe on file:line (same call site = same call).
function unionIntoRawMap(rawMap, dm) {
  const { normalizeRoute } = require('../lib/url-normalize');
  const pkOf = (route) => (String(route).startsWith('trpc:') ? String(route) : normalizeRoute(String(route)));
  rawMap.routes = rawMap.routes || []; rawMap.feCalls = rawMap.feCalls || [];
  const routeKeys = new Set(rawMap.routes.map((r) => `${r.method} ${pkOf(r.route)}`));
  // Dedup FE calls on file|method|url, NOT file:line — the pattern extractor and the deep-map's
  // feCallsIn can assign different lines to the same multi-line `fetch(` (→ double-count), and two
  // distinct calls on ONE line (`Promise.all([fetch(a), fetch(b)])`) share a line (→ one silently
  // dropped). url+method+file is the stable identity (review fix).
  const callKey = (file, method, url) => `${file}|${String(method || 'GET').toUpperCase()}|${url}`;
  const callKeys = new Set(rawMap.feCalls.map((c) => callKey(c.file, c.method, c.url)));
  let routesAdded = 0, callsAdded = 0;
  for (const f of dm.files || []) {
    for (const e of f.exposesEndpoints || []) {
      if (e.type !== 'route') continue;
      const key = `${e.method} ${pkOf(e.route)}`;
      if (routeKeys.has(key)) continue;
      routeKeys.add(key);
      rawMap.routes.push({ file: f.file, line: e.line || 0, method: e.method, route: e.route, handler: e.handler || '', ...(e.transport ? { transport: e.transport } : {}), ...(e.guards && e.guards.length ? { guards: e.guards } : {}) });
      routesAdded++;
    }
    for (const c of f.connectionsOut || []) {
      const key = callKey(f.file, c.method, c.target);
      if (callKeys.has(key)) continue;
      callKeys.add(key);
      rawMap.feCalls.push({ file: f.file, line: c.line || 0, method: c.method || 'GET', url: c.target, urlKind: String(c.target).startsWith('trpc:') ? 'trpc' : 'deep' });
      callsAdded++;
    }
  }
  return { routesAdded, callsAdded };
}

module.exports = { buildDeterministicDeepMap, writeDeterministicDeepMap, unionIntoRawMap };
