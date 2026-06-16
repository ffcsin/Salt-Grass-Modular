'use strict';
// Cross-store write-consistency analysis — the "we have 3 DBs holding overlapping data and they
// drift" problem (field testing on a Go/Next monorepo: Postgres + a Neo4j graph + a TigerBeetle ledger). When one
// logical operation writes N stores with no shared atomicity, a partial failure leaves them
// inconsistent: a member row with no ledger accounts, a paid commission with no tree edge, etc.
//
// What it does, deterministically + dependency-free: per function, detect which stores it WRITES,
// flag any function writing 2+ stores, and grade the atomicity guard it uses (PG-tx-only / outbox /
// compensation / none). A 2-store writer with no outbox + no compensation is a drift hazard; ranked
// by whether a money/ledger store is involved. This is a HYPOTHESIS generator — every hit needs the
// trust-but-verify pass (the guard may live one call-frame away). It never executes anything.

// Store signatures — extensible. `write` = regexes that indicate a WRITE to that store; `kind`
// flags ledger/money stores (a drift there is financial). Add a row to support a new datastore.
const STORES = [
  { id: 'postgres', label: 'Postgres/SQL', kind: 'relational',
    write: [/\bINSERT\s+INTO\b/i, /\bUPDATE\s+["'`\w]/i, /\bDELETE\s+FROM\b/i, /\bUPSERT\b/i, /\.ExecContext\(/, /\btx\.Exec\(/, /\bExecContext\(/] },
  { id: 'neo4j', label: 'Neo4j (graph)', kind: 'graph',
    write: [/\bExecuteWrite\b/, /\bWriteTransaction\b/, /\bMERGE\s*\(/, /\bCREATE\s*\(/, /\bDETACH\s+DELETE\b/, /cypher[\s\S]{0,40}\bSET\b/i] },
  { id: 'tigerbeetle', label: 'TigerBeetle (ledger)', kind: 'ledger',
    write: [/\bCreateTransfers\b/, /\bCreateAccounts\b/, /\bCreateMemberWithAccounts\b/, /\bPostTransfer\b/] },
  { id: 'mongo', label: 'MongoDB', kind: 'document',
    write: [/\.(InsertOne|InsertMany|UpdateOne|UpdateMany|ReplaceOne|DeleteOne|DeleteMany|BulkWrite|FindOneAndUpdate)\b/] },
  { id: 'mysql', label: 'MySQL', kind: 'relational', write: [] }, // covered by SQL regexes under postgres; kept for label parity
  { id: 'redis', label: 'Redis', kind: 'cache',
    write: [/\.(Set|HSet|SAdd|LPush|RPush|Incr|Expire|Del)\s*\(/] },
  { id: 'dynamodb', label: 'DynamoDB', kind: 'document',
    write: [/\.(PutItem|UpdateItem|DeleteItem|BatchWriteItem|TransactWriteItems)\b/] },
  { id: 'elasticsearch', label: 'Elasticsearch', kind: 'search',
    write: [/\.(Index|Bulk|Update|Delete)\(\s*["'`]?(?:index|doc)/i, /esClient\.(index|bulk|update)/i] },
];

// Atomicity guards — signals that a multi-store write is NOT naive sequential best-effort.
const GUARDS = {
  pgTx: [/\bBeginTx\b/, /\bBegin\(\)/, /\btx\.Commit\(/, /\.Begin\(ctx/],
  outbox: [/\boutbox\b/i, /transactional[_-]?outbox/i, /\benqueueEvent\b/i, /\bpublishAfterCommit\b/i],
  // NOTE: a bare tx.Rollback() is SQL-tx hygiene present in every Go PG function — it is NOT
  // cross-store compensation and must not downgrade a finding (it false-mitigated the trial fixtures).
  saga: [/\bsaga\b/i, /\bcompensat/i, /\bReverse(Transfer|Transaction|Entry)\b/, /\bUndo\b/],
  reconcile: [/reconcil/i, /\bconsistency\b/i, /\bdrift\b/i, /\bsync(Job|er)\b/i],
};

// Carve a source file into top-level functions. Go: `func ...` at column 0 → next `func` at col 0.
// TS/JS: exported/standalone `function`/arrow + method declarations via brace tracking. Returns
// [{name, start, end, body, line}]. Coarse but enough to attribute writes to one operation.
function functionsOf(content, lang) {
  const lines = String(content || '').split('\n');
  const fns = [];
  if (lang === 'go') {
    let cur = null;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^func\s+(?:\([^)]*\)\s*)?([A-Za-z0-9_]+)/);
      if (m) {
        if (cur) { cur.end = i - 1; cur.body = lines.slice(cur.startLine, i).join('\n'); fns.push(cur); }
        cur = { name: m[1], line: i + 1, startLine: i };
      }
    }
    if (cur) { cur.end = lines.length - 1; cur.body = lines.slice(cur.startLine).join('\n'); fns.push(cur); }
    return fns;
  }
  // TS/JS — brace-track each function/method/arrow assigned to a name.
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(?:async\s+)?(?:function\s+([A-Za-z0-9_]+)|(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(|([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{)/);
    if (!m) continue;
    const name = m[1] || m[2] || m[3];
    if (!name || /^(if|for|while|switch|catch|return)$/.test(name)) continue;
    let depth = 0, started = false, end = i;
    for (let j = i; j < lines.length && j < i + 400; j++) {
      for (const ch of lines[j]) { if (ch === '{') { depth++; started = true; } else if (ch === '}') depth--; }
      if (started && depth <= 0) { end = j; break; }
    }
    fns.push({ name, line: i + 1, startLine: i, end, body: lines.slice(i, end + 1).join('\n') });
  }
  return fns;
}

function storesWrittenIn(body) {
  const hit = new Set();
  for (const s of STORES) for (const re of s.write) if (re.test(body)) { hit.add(s.id); break; }
  return [...hit];
}

function guardsIn(body) {
  const g = [];
  for (const [name, res] of Object.entries(GUARDS)) if (res.some((re) => re.test(body))) g.push(name);
  return g;
}

// The single highest-signal drift pattern (two independent real-world bugs had it verbatim): a non-SQL
// store write whose error is LOGGED AND SWALLOWED with a "later/don't fail/best effort" comment.
// The operation reports success, the event system never retries, and any exists/ON CONFLICT
// idempotency skip-path then prevents a retry from ever healing the missed store.
const SWALLOWED_RE = /(CreateTransfers|CreateAccounts|CreateMemberWithAccounts|PostTransfer|ExecuteWrite|WriteTransaction)[\s\S]{0,260}?(?:logger?|log|s\.log\w*)\.(Error|Warn)\w*\([\s\S]{0,200}?(?:later|don'?t fail|best.?effort|non.?fatal|can happen|continue anyway|swallow)/i;
function swallowedFailure(body) { return SWALLOWED_RE.test(body); }

const langOf = (file) => file.endsWith('.go') ? 'go' : /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file) ? 'ts' : null;

// Analyze ONE file → array of multi-store write findings (functions writing 2+ stores).
function scanStoreConsistency(content, file) {
  const lang = langOf(file);
  if (!lang) return [];
  const out = [];
  for (const fn of functionsOf(content, lang)) {
    const stores = storesWrittenIn(fn.body);
    if (stores.length < 2) continue;
    const guards = guardsIn(fn.body);
    const touchesLedger = stores.some((id) => (STORES.find((s) => s.id === id) || {}).kind === 'ledger');
    // Risk: outbox or saga/compensation present → mitigated. PG-tx-only does NOT cover the non-SQL
    // stores, so it's NOT a mitigation for multi-store atomicity (the common false-comfort). None → naive.
    const mitigated = guards.includes('outbox') || guards.includes('saga');
    const swallowed = swallowedFailure(fn.body);
    let severity, pattern;
    if (swallowed) { severity = 'High'; pattern = 'SWALLOWED store-failure (logged + "later", never retried)'; }
    else if (mitigated) { severity = 'Low'; pattern = guards.includes('outbox') ? 'outbox/eventual' : 'compensation/saga'; }
    else if (touchesLedger) { severity = 'High'; pattern = 'sequential best-effort (ledger involved)'; }
    else { severity = 'Medium'; pattern = 'sequential best-effort'; }
    out.push({
      file, fn: fn.name, line: fn.line, stores, guards,
      pattern, severity,
      note: swallowed ? 'store-write error logged-and-continued; if an exists/ON-CONFLICT skip-path guards re-entry, retries can NEVER heal the missed store'
        : guards.includes('pgTx') && !mitigated ? 'has a PG tx, but it does NOT span the non-SQL store(s) — partial-failure drift still possible' : undefined,
    });
  }
  return out;
}

module.exports = { scanStoreConsistency, functionsOf, storesWrittenIn, guardsIn, STORES, GUARDS };
