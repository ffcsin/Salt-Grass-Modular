'use strict';
// Deterministic route/call extraction for the modern Bun/TS stack the NestJS-only AST extractor misses:
//   • Hono       — `app.get("/path", ...)` chained off `new Hono()` (any var name; leading-slash literal)
//   • tRPC       — `appRouter = router({ ns: nsRouter })` composition + `proc: protectedProcedure.query/mutation`
//   • TanStack   — `createFileRoute('/path')` file-based FE routes (FE surface, not a BE endpoint)
//   • FE→tRPC    — `trpc.ns.proc.useQuery/useMutation` call-sites
//   • template   — `fetch(`${apiUrl}/api/x`)` — normalize a leading `${...}` so the path is matchable
// All pure + line-aware + zero-dep (regex, not the TS compiler) so it runs in the same deterministic pass
// as the AST extractor. tRPC procedures are modelled as routes id'd `trpc:<ns>.<proc>` (exact-string
// matched against FE `trpc:<ns>.<proc>` targets — no REST path-normalization needed), and the procedure
// helper name (protected/public/supervisor/...) is captured as the route GUARD so RBAC diagnostics get
// real signal on a tRPC backend.

const lineOf = (content, idx) => content.slice(0, idx).split('\n').length;

// A file is a Hono router iff it actually pulls in hono (import or `new Hono(`) — without this gate the
// leading-slash `.get("/x")` heuristic would mis-claim any HTTP-client call (`client.get("/users")`).
function usesHono(content) {
  return /\bfrom\s+['"]hono['"]/.test(content) || /\brequire\(\s*['"]hono['"]/.test(content) || /\bnew\s+Hono\b/.test(content);
}

// Path params from a Hono/Express-style route string: ":brand" / ":id" → ['brand','id'].
function pathParams(route) {
  const out = [];
  const re = /:([A-Za-z_]\w*)/g; let m;
  while ((m = re.exec(route)) !== null) out.push(m[1]);
  return out;
}

// Best-effort middleware/guard names: identifiers sitting between the route string and the handler arg
// (`app.get("/x", requireAuth, async (c) => ...)` → ['requireAuth']). Stops at the first handler-looking
// token (`async`, `(c`, `(ctx`, `=>`) so the handler body is never scanned.
function honoGuards(argTail) {
  const head = argTail.split(/async|\(\s*c\b|\(\s*ctx\b|=>/)[0];
  const out = [];
  const re = /([A-Za-z_$][\w$]*(?:\([^)]*\))?)/g; let m;
  while ((m = re.exec(head)) !== null) {
    const tok = m[1];
    if (/^(c|ctx|req|res|next)$/.test(tok)) continue;
    if (/^[A-Za-z_$]/.test(tok)) out.push(tok);
  }
  return out;
}

const HONO_RE = /(?:^|[^.\w$])([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|all|options|head)\(\s*[`'"](\/[^`'"]*)[`'"]\s*(,?[^\n]*)/g;
// app.on("METHOD", "/path") and app.on(["POST","GET"], "/path") — the multi-method mount form Hono
// uses for sub-app wiring (Better Auth mounts as app.on(["POST","GET"], "/api/auth/**", handler)).
const HONO_ON_RE = /(?:^|[^.\w$])([A-Za-z_$][\w$]*)\.on\(\s*(\[[^\]]*\]|[`'"][A-Za-z]+[`'"])\s*,\s*[`'"](\/[^`'"]*)[`'"]/g;
// The Hono instance var(s) in a file: `const app = new Hono()`, `const api = new Hono<Env>()`.
// Restricting route matching to these excludes `someMap.get("/k")` / `headers.get("/x")` — which a
// leading-slash literal would otherwise mis-claim as routes (review fix). Empty ⇒ permissive fallback
// (Hono used via a factory/import we can't name) so we never silently lose real routes.
const HONO_VAR_RE = /\b([A-Za-z_$][\w$]*)\s*=\s*new\s+Hono\b/g;
function honoVarsIn(content) {
  const s = new Set(); HONO_VAR_RE.lastIndex = 0; let m;
  while ((m = HONO_VAR_RE.exec(content)) !== null) s.add(m[1]);
  return s;
}
function honoRoutesIn(content) {
  if (!usesHono(content)) return [];
  const honoVars = honoVarsIn(content);
  const bound = (recv) => honoVars.size === 0 || honoVars.has(recv); // fallback permissive if none named
  const out = [];
  HONO_RE.lastIndex = 0; let m;
  while ((m = HONO_RE.exec(content)) !== null) {
    const [, recv, method, route, tail] = m;
    if (!bound(recv)) continue;
    out.push({
      method: method.toUpperCase(), route,
      params: { query: [], body: [], path: pathParams(route) },
      guards: tail && tail.startsWith(',') ? honoGuards(tail.slice(1)) : [],
      line: lineOf(content, m.index), handler: '', kind: 'hono',
    });
  }
  HONO_ON_RE.lastIndex = 0;
  while ((m = HONO_ON_RE.exec(content)) !== null) {
    const [, recv, methodsRaw, route] = m;
    if (!bound(recv)) continue;
    const methods = (methodsRaw.match(/[A-Za-z]+/g) || []).filter((x) => /^(get|post|put|patch|delete|all|options|head)$/i.test(x));
    for (const method of methods.length ? methods : ['ALL']) {
      out.push({
        method: method.toUpperCase(), route,
        params: { query: [], body: [], path: pathParams(route) },
        guards: [], line: lineOf(content, m.index), handler: '', kind: 'hono',
      });
    }
  }
  return out;
}

// appRouter composition: inside `router({ ... })`, `ns: someRouter` → { someRouter: 'ns' }. Only values
// ending in `Router` count (so a procedure prop `getSession: protectedProcedure` is never read as a ns).
const NS_RE = /([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*Router)\b/g;
function trpcNamespaces(content) {
  const map = {};
  NS_RE.lastIndex = 0; let m;
  while ((m = NS_RE.exec(content)) !== null) map[m[2]] = m[1];
  return map;
}

// The router var(s) DEFINED in a file: `export const authRouter = router({` → ['authRouter']. Used to
// attribute the file's procedures to a namespace (a sub-router file defines exactly one in practice).
const ROUTER_DEF_RE = /\b([A-Za-z_$][\w$]*Router)\s*=\s*router\s*\(\s*\{/g;
function routerDefsIn(content) {
  const out = []; ROUTER_DEF_RE.lastIndex = 0; let m;
  while ((m = ROUTER_DEF_RE.exec(content)) !== null) out.push({ routerVar: m[1], index: m.index });
  return out;
}

// Mount edges: each `key: childRouter` pair attributed to the nearest PRECEDING router def in the same
// file. This captures NESTING — `briefRouter = router({ departments: departmentsRouter })` mounted as
// `brief: briefRouter` means departmentsRouter's client namespace is `brief.departments`, not
// `departments` (flat resolution mis-keys every nested procedure).
function trpcMountsIn(content) {
  const defs = routerDefsIn(content);
  const ownerOf = (idx) => { let best = null; for (const d of defs) if (d.index < idx && (!best || d.index > best.index)) best = d; return best ? best.routerVar : null; };
  const out = []; NS_RE.lastIndex = 0; let m;
  while ((m = NS_RE.exec(content)) !== null) out.push({ parentVar: ownerOf(m.index), key: m[1], childVar: m[2] });
  return out;
}

// Resolve router vars to dotted client namespaces by walking mount edges to the root (memoized,
// cycle-guarded). A router mounted by an anonymous/def-less root keeps its mount key as the top
// segment. Returns null for an UNMOUNTED router (no client-visible path) — callers may fall back.
function resolveRouterNamespaces(allMounts) {
  const edge = {};
  for (const mt of allMounts || []) if (mt && mt.childVar) edge[mt.childVar] = mt;
  const memo = {};
  return function nsOf(routerVar) {
    if (routerVar in memo) return memo[routerVar];
    const path = []; const seen = new Set(); let cur = routerVar;
    while (cur && edge[cur] && !seen.has(cur) && path.length < 12) {
      seen.add(cur);
      path.unshift(edge[cur].key);
      cur = edge[cur].parentVar;
    }
    return (memo[routerVar] = path.length ? path.join('.') : null);
  };
}

// Procedures in a router file: `name: protectedProcedure ...` then the first `.query(`/`.mutation(`/
// `.subscription(` reached gives the method. The helper identifier may CONTAIN Procedure rather than
// end with it — custom builders like protectedProcedureHr / protectedProcedureAbac are real idioms.
const PROC_RE = /(?:^|[\s{,(])([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*[Pp]rocedure[\w$]*)\b/g;
function procMethod(content, fromIdx) {
  const slice = content.slice(fromIdx, fromIdx + 4000);
  const mm = slice.match(/\.(query|mutation|subscription)\s*\(/);
  if (!mm) return null;
  return mm[1] === 'mutation' ? 'POST' : mm[1] === 'subscription' ? 'SUB' : 'GET';
}
// Emit guard tokens the token-based RBAC layer (isPublic) understands. tRPC's auth lives in the
// procedure-helper NAME: publicProcedure → public, bare procedure → no middleware (public by
// convention), protectedProcedure → session auth, anything else (supervisorProcedure,
// adminProcedureX, protectedProcedureHr…) → role/policy-gated wrappers. Bare kinds like 'supervisor'
// carry no auth-shaped token, so isPublic would mis-read them as public — prefix with auth:/role:.
// A SUFFIX after Procedure (…ProcedureHr / …ProcedureAbac) is an extra policy qualifier → its own
// role: token, so the guard set distinguishes plain protected from protected+HR-policy.
function guardOfProcedure(procType) {
  const m = String(procType).match(/^([\w$]*?)[Pp]rocedure([\w$]*)$/);
  const prefix = m ? m[1].replace(/[_$]+$/, '') : '';
  const suffix = m ? m[2].replace(/^[_$]+/, '') : '';
  if (/^public$/i.test(prefix)) return ['public'];
  const guards = [];
  if (/^protected$/i.test(prefix)) guards.push('auth:protected');
  else if (prefix) guards.push(`role:${prefix.charAt(0).toLowerCase() + prefix.slice(1)}`);
  if (suffix) guards.push(`role:${suffix.charAt(0).toLowerCase() + suffix.slice(1)}`);
  return guards;
}
function trpcProceduresIn(content) {
  const defs = routerDefsIn(content);
  const ownerOf = (idx) => { let best = null; for (const d of defs) if (d.index < idx && (!best || d.index > best.index)) best = d; return best ? best.routerVar : null; };
  const out = []; PROC_RE.lastIndex = 0; let m;
  while ((m = PROC_RE.exec(content)) !== null) {
    const [, name, procType] = m;
    const method = procMethod(content, m.index + m[0].length);
    if (!method) continue; // not actually a procedure call chain
    out.push({ name, routerVar: ownerOf(m.index), method, guards: guardOfProcedure(procType), line: lineOf(content, m.index) });
  }
  return out;
}

// FE tRPC call-sites: trpc.<dotted.chain>.useQuery/useMutation/... → target `trpc:<dotted.chain>`.
// The chain may be 2+ segments deep — nested routers produce trpc.brief.departments.update.useMutation,
// whose target is trpc:brief.departments.update (matches the nested route id exactly).
const TRPC_FE_RE = /\btrpc((?:\.[A-Za-z_$][\w$]*)+)\.(useQuery|useMutation|useSuspenseQuery|useInfiniteQuery|useSuspenseInfiniteQuery|query|mutate|fetch)\b/g;
function trpcFeCallsIn(content) {
  const out = []; TRPC_FE_RE.lastIndex = 0; let m;
  while ((m = TRPC_FE_RE.exec(content)) !== null) {
    const chain = m[1].slice(1).split('.');
    if (chain.length < 2) continue; // need at least ns + proc
    const hook = m[2];
    const method = /mutation|mutate/i.test(hook) ? 'POST' : 'GET';
    out.push({ type: 'http-call', target: `trpc:${chain.join('.')}`, method, params: { body: [], query: [] }, line: lineOf(content, m.index) });
  }
  return out;
}

// TanStack file-based FE routes: createFileRoute('/path') / createRootRoute(). FE surface, recorded so
// the FE inventory + dead-route analysis see them (not a backend endpoint).
const TANSTACK_RE = /\bcreate(?:File|Root)Route\s*(?:<[^>]*>)?\s*\(\s*(?:[`'"]([^`'"]*)[`'"])?/g;
function tanstackRoutesIn(content) {
  const out = []; TANSTACK_RE.lastIndex = 0; let m;
  while ((m = TANSTACK_RE.exec(content)) !== null) out.push({ route: m[1] || '/', line: lineOf(content, m.index), kind: 'tanstack' });
  return out;
}

// Normalize a fetch URL that begins with a template expr: `${apiUrl}/api/x` → `/api/x`; `${base}` → null.
function normalizeTemplateUrl(url) {
  const stripped = url.replace(/^\$\{[^}]*\}/, '');
  if (stripped.startsWith('/')) return stripped;
  if (/^https?:\/\//.test(stripped)) return stripped;
  return null;
}

module.exports = {
  usesHono, pathParams, honoGuards, honoRoutesIn,
  trpcNamespaces, trpcMountsIn, resolveRouterNamespaces, routerDefsIn, trpcProceduresIn, trpcFeCallsIn,
  tanstackRoutesIn, normalizeTemplateUrl, lineOf,
};
