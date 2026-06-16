export const meta = {
  name: 'deep-extract-sweep',
  description: 'Fan out the deep-extract skill over a repo\'s API-bearing files, accumulating a glossary; returns raw per-file inventories for the deterministic pipeline (normalize/line-correct/merge/verify in bin/deep-map.js).',
  phases: [{ title: 'Seed' }, { title: 'Bulk' }],
};

// INLINED batches (6 batches)
const batches = [["src/pages/about.astro","src/pages/api/health.ts","src/pages/api/s.ts","src/pages/api/t.ts","src/pages/blog/[slug].astro","src/pages/blog/index.astro"],["src/pages/blog/rss.xml.ts","src/pages/compare/[slug].astro","src/pages/compare/index.astro","src/pages/contact.astro","src/pages/cost/[slug].astro","src/pages/developers.astro"],["src/pages/financing.astro","src/pages/glossary.astro","src/pages/homeowners.astro","src/pages/index.astro","src/pages/locations/[slug].astro","src/pages/locations/index.astro"],["src/pages/military.astro","src/pages/models/container-homes.astro","src/pages/models/pools.astro","src/pages/privacy.astro","src/pages/process.astro","src/pages/projects.astro"],["src/pages/qr/[code].astro","src/pages/saltgrass-101/[slug].astro","src/pages/saltgrass-101.astro","src/pages/services/container-homes.astro","src/pages/services/developers.astro","src/pages/services/disaster-relief.astro"],["src/pages/services/index.astro","src/pages/services/pools.astro","src/pages/services/traditional-builds.astro","src/pages/terms.astro"]];
let glossary = [];

const DEEP_SKILL = `You are the agentic-os deep-extract intelligence. READ EACH listed file FULLY, then emit one JSON object PER FILE.

⚠️ READ THE ENTIRE FILE — NO PARTIAL READS. The Read tool returns at most ~2000 lines per call. If a file is longer, you MUST page through it with repeated Read calls (offset/limit) until you have read EVERY line to the end. A large file (e.g. 11,000 lines) needs ~6 Read calls. The most common and worst failure is missing an outbound API call (axios/fetch) buried deep in a long file because you only read the top — that is a hole in the wireup and is NOT acceptable. After reading, your selfCheck.httpCallsOut MUST reflect EVERY outbound call in the WHOLE file.

You are NOT given a checklist of "find auth / find params / find locationId" — that's a scanner; you're an intelligence. You DECIDE what is significant for THIS file in THIS repo (route decorators + a tenant id on NestJS; before_action on Rails; middleware on Go; etc.).

For EACH file emit one JSON object with EXACTLY these keys:
{
  "file": "<path>",
  "kind": "frontend|backend|shared|config|test|infra|other",
  "purpose": "<1-2 plain sentences: what this file is and does>",
  "connectionsOut": [{ "type": "http-call|db|queue|external-api|import|event|...", "target": "<REQUIRED: URL/route for http-call, table, queue, or service name>", "method": "<HTTP method or null>", "params": {"query":[],"body":[]}, "detail": "<short or ''>", "line": 0, "confidence": "high|med|low" }],
  "exposesEndpoints": [{ "type": "route|export|handler|event-listener|...", "id": "<REQUIRED: the callable identity others use — full route path, export name>", "method": "<HTTP method or null>", "params": {"query":[],"body":[],"path":[]}, "guards": [], "detail": "<short or ''>", "line": 0, "confidence": "high|med|low" }],
  "findings": [{ "kind": "security|tenancy|perf|dead-code|gotcha|inconsistency|...", "note": "<what you noticed and why it matters>", "line": 0, "confidence": "high|med|low" }],
  "discoveredConventions": [{ "name": "<e.g. 'multi-tenant scoping via locationId'>", "evidence": "<what in this file shows it>", "appliesTo": "this file|this module|repo-wide" }],
  "selfCheck": { "exposesEndpointsCount": 0, "httpCallsOut": 0, "findingsCount": 0 }
}

RULES (follow all):
- No fixed checklist — report what's significant for THIS file. Different files yield different shapes of findings/conventions.
- connectionsOut + exposesEndpoints are the FIXED thin spine that wires files together. Field names are REQUIRED and FIXED: use 'target' (not url), 'line' (not location), 'detail' (not notes). Every spine item has exactly the keys shown (null/[]/'' when N/A). ALL open-ended judgment goes in findings — never bend the spine.
- NEVER miss an outbound network/API call. EVERY fetch/authFetch/axios/HTTP-client call MUST appear in connectionsOut as type 'http-call' with target URL + method + params — the FE<->BE wireup is built from these; a missed call = a hole in the map.
- For backend routes, ALWAYS capture guards/auth (decorators, middleware, role checks) in exposesEndpoints.guards, and the param shapes (body/query/path) — these are what RBAC + param analysis depend on.
- Honesty / trust-but-verify: tag confidence on what you OBSERVED (high). If you infer a RISK/bug (tenant-isolation gap, privilege escalation), keep it med/low and phrase as a hypothesis — the observation may be solid while the implication is a guess. Never assert a risk as fact.
- selfCheck: fill counts honestly (it lets the verify pass catch under/over-extraction).
- Learn: if a pattern likely recurs (auth wrapper, tenancy id, gating decorator, naming), record it in discoveredConventions so the next agent inherits it. Reuse a GLOSSARY name if one already exists (consistency).
- Cite line numbers. Read the WHOLE file before emitting. Output JSON only — no prose.`;

const BATCH_SCHEMA = {
  type: 'object',
  properties: { inventories: { type: 'array', items: { type: 'object' } },
    discoveredConventions: { type: 'array', items: { type: 'object' } } },
  required: ['inventories'],
};

function mergeGlossary(into, more) {
  for (const g of more || []) if (g && g.name && !into.find((x) => x.name === g.name)) into.push(g);
}

// SEED round — first batch sequentially to build glossary v1
phase('Seed');
const all = [];
if (batches.length) {
  const seed = await agent(
    `${DEEP_SKILL}\nGlossary so far: ${JSON.stringify(glossary)}\nFiles: ${batches[0].join(', ')}`,
    { schema: BATCH_SCHEMA, label: 'seed', phase: 'Seed', model: 'sonnet' });
  if (seed) { all.push(...(seed.inventories || [])); mergeGlossary(glossary, seed.discoveredConventions); }
}

// BULK round — SELF-THROTTLED: process in waves of WAVE concurrent agents (not all at once).
// Firing hundreds of agents simultaneously trips the inference API's server-side concurrency
// throttle ("not your usage limit · Rate limited"), which silently kills whole batches. Waves
// of ~6 keep us under that ceiling while still parallelising. Glossary compounds across waves.
phase('Bulk');
const rest = batches.slice(1);
const WAVE = 6;
const results = [];
for (let i = 0; i < rest.length; i += WAVE) {
  const wave = rest.slice(i, i + WAVE);
  const waveRes = await parallel(wave.map((b) => () =>
    agent(`${DEEP_SKILL}\nKnown repo conventions: ${JSON.stringify(glossary)}\nFiles: ${b.join(', ')}`,
      { schema: BATCH_SCHEMA, label: b[0], phase: 'Bulk', model: 'sonnet' })));
  for (const r of waveRes.filter(Boolean)) { all.push(...(r.inventories || [])); mergeGlossary(glossary, r.discoveredConventions); }
  results.push(...waveRes);
}

log(`deep-extract-sweep: ${all.length} file inventories, ${glossary.length} glossary conventions`);
return { inventories: all, glossary };
