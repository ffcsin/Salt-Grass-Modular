'use strict';
// Deterministic default PatternSet — lets `map.js` run WITHOUT the discover-patterns agent, for the
// common stacks. This is what makes the full bootstrap a single, agent-free command on any JS/TS repo
// (and a decent baseline for Python). The agentic discover-patterns step still exists for exotic
// stacks / to refine these — but for NestJS/Next/Express/Fastify/React this gets the structural map.
function defaultPatternSet(stack = {}) {
  const fw = new Set([...(stack.frameworks || [])].map((s) => String(s).toLowerCase()));
  const langs = new Set([...(stack.languages || [])].map((s) => String(s).toLowerCase()));
  const isPy = langs.has('python') || fw.has('fastapi') || fw.has('flask') || fw.has('django');

  const JS_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  const feCallPatterns = [
    { regex: "(?:authFetch|apiFetch|fetch)\\(\\s*[`'\"]([^`'\"]+)", flags: 'g', urlGroup: 1, methodHint: 'GET' },
    { regex: "axios\\.(?:get|post|put|delete|patch)\\(\\s*[`'\"]([^`'\"]+)", flags: 'g', urlGroup: 1, methodHint: 'GET' },
    { regex: "axios\\(\\s*\\{[^}]*url:\\s*[`'\"]([^`'\"]+)", flags: 'g', urlGroup: 1, methodHint: 'GET' },
    { regex: "(?:useSWR|useQuery)\\(\\s*[`'\"]([^`'\"]+)", flags: 'g', urlGroup: 1, methodHint: 'GET' },
    // OpenAPI/codegen typed clients (hey-api, custom wrappers): client.get({ url: '/path', ... }) and
    // (options?.client ?? client).post<Generics>({ url: '/path', ...options }) — the VERB is the function
    // name (methodGroup), the path lives under the `url:` key, possibly on the next line. Keys BEFORE
    // url: may carry one level of nesting (hey-api emits `security: [{ name: ..., type: ... }],` first
    // on authenticated calls — 495 of 833 SDK calls), hence the (?:[^{}]|\{...\})*? alternation;
    // a bare `}` is unmatchable by either branch, so the scan can never cross out of this call.
    { regex: "\\.(get|post|put|patch|delete)\\s*(?:<[^(){};]*>)?\\s*\\(\\s*\\{(?:[^{}]|\\{[^{}]*\\})*?url:\\s*[`'\"]([^`'\"]+)", flags: 'g', methodGroup: 1, urlGroup: 2, ext: JS_EXTS },
    // openapi-fetch style: client.GET('/path', {...}) — UPPERCASE verb + leading-slash literal.
    // ext-scoped to JS/TS so gin's r.GET("/path") in .go files never double-counts as an FE call.
    { regex: "\\.(GET|POST|PUT|PATCH|DELETE)\\(\\s*[`'\"](/[^`'\"]*)", flags: 'g', methodGroup: 1, urlGroup: 2, ext: JS_EXTS },
  ];
  const surfacePatterns = [{ regex: 'on(Click|Submit|Change)=', flags: 'g', kindGroup: 1 }];

  const routePatterns = [];
  const routePrefixPatterns = [];
  const fileRoutes = [];

  // NestJS — JS-ext-scoped: decorators only exist in TS/JS source.
  routePatterns.push({ regex: '@(Get|Post|Put|Delete|Patch|All)\\(\\s*[`\'"]?([^`\'")]*)', flags: 'g', methodGroup: 1, routeGroup: 2, ext: JS_EXTS });
  routePrefixPatterns.push({ regex: "@Controller\\(\\s*[`'\"]([^`'\"]*)", flags: 'g', prefixGroup: 1 });
  // Express / Fastify / Koa routers — JS-ext-scoped: the gi flag makes this shape match Python's
  // @app.get("/x") decorator (double-extracting every Flask/FastAPI route) and Go's router.GET("/x")
  // (double-extracting gin routes on a variable named router) when run unscoped. Caught by the
  // gauge-parity test.
  routePatterns.push({ regex: "(?:router|app|fastify|route)\\.(get|post|put|delete|patch|all)\\(\\s*[`'\"]([^`'\"]+)", flags: 'gi', methodGroup: 1, routeGroup: 2, ext: JS_EXTS });

  // Next.js file-based API routes. The app may live at the repo root OR inside src/ OR inside a
  // component dir (e.g.: frontend/src/app) — probe the conventional locations; absent dirs cost nothing.
  if (fw.has('nextjs') || fw.has('next')) {
    for (const pre of ['', 'src/', 'frontend/', 'frontend/src/', 'web/', 'web/src/', 'client/', 'client/src/']) {
      fileRoutes.push({ baseDir: `${pre}app`, exts: ['.ts', '.tsx', '.js'], filePattern: 'route' });
      fileRoutes.push({ baseDir: `${pre}pages/api`, exts: ['.ts', '.js'] });
    }
  }

  // Python (FastAPI / Flask)
  if (isPy) {
    routePatterns.push({ regex: '@(?:app|router)\\.(get|post|put|delete|patch)\\(\\s*[`\'"]([^`\'"]+)', flags: 'g', methodGroup: 1, routeGroup: 2, ext: ['.py'] });
    routePatterns.push({ regex: "@(?:app|bp)\\.route\\(\\s*[`'\"]([^`'\"]+)", flags: 'g', routeGroup: 1, ext: ['.py'] }); // no methodGroup → defaults GET (group 0 = whole match, never a method)
  }

  // Go (gin/echo UPPER-case · chi/fiber Title-case · net/http mux). Group("/prefix") is the gin/echo
  // router-group prefix (the @Controller analogue). Found missing in field testing on a Go/Next monorepo.
  const isGo = langs.has('go');
  if (isGo) {
    // Paths must start with "/" — that's what separates a gin/chi route from viper.Get("db.host"),
    // header.Get("Content-Type") and other same-shaped non-route calls. ext-scoped to .go so the
    // identical shape in TS (openapi-fetch's client.GET('/x')) is an FE call, never a route.
    // The path may also be EMPTY — g.GET("", handler) on a fully-pathed Group is the dominant gin
    // idiom for single-resource routers (24 of the trial repo's /accounts/me/* routes were invisible without it);
    // composePath(prefix, '') resolves to the group prefix itself.
    routePatterns.push({ regex: '\\.(GET|POST|PUT|PATCH|DELETE)\\(\\s*"(/[^"]*|)"', flags: 'g', methodGroup: 1, routeGroup: 2, ext: ['.go'] });
    routePatterns.push({ regex: '\\.(Get|Post|Put|Patch|Delete)\\(\\s*"(/[^"]*|)"', flags: 'g', methodGroup: 1, routeGroup: 2, ext: ['.go'] });
    routePatterns.push({ regex: '\\.HandleFunc\\(\\s*"(/[^"]*)"', flags: 'g', routeGroup: 1, ext: ['.go'] }); // no methodGroup → method defaults GET (group 0 = whole match, never a method)
    routePrefixPatterns.push({ regex: '\\.Group\\(\\s*"(/[^"]*)"', flags: 'g', prefixGroup: 1 });
  }

  const frontend = ['**/*.tsx', '**/*.jsx'];
  const backend = [
    ...(isPy ? ['**/*.py'] : []),
    ...(isGo ? ['**/*.go'] : []),
    ...(!isPy && !isGo ? ['**/*.ts', '**/*.js'] : (langs.has('javascript') ? ['**/*.ts', '**/*.js'] : [])),
  ];

  return {
    version: 1,
    stack: { languages: [...langs], frameworks: [...fw], sourceRoots: stack.sourceRoots || [], manifests: stack.manifests || ['package.json'] },
    fileGlobs: { frontend, backend },
    feCallPatterns, routePrefixPatterns, routePatterns, surfacePatterns,
    ...(fileRoutes.length ? { fileRoutes } : {}),
  };
}

module.exports = { defaultPatternSet };
