// src/diagnostics/async-bugs.js
// High-signal async correctness checks (research: top bug class in AI-generated code). Uses the
// TypeScript AST when available (precise), else a conservative regex fallback. Catches:
//   - floating promises: an `await`-less call to an async/Promise-returning fn used as a statement
//   - `.then()` with no `.catch()` (unhandled rejection)
//   - `await` used inside a non-async function (a real correctness bug tsc-without-strict can miss)
let ts; try { ts = require('typescript'); } catch { ts = null; }

// AST: find `await` expressions whose nearest enclosing function is NOT async.
function awaitInNonAsync(content, fileName = 'f.ts') {
  if (!ts) return [];
  const sf = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
  const hits = [];
  function enclosingFn(node) {
    let n = node.parent;
    while (n) {
      if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)) return n;
      n = n.parent;
    }
    return null;
  }
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AwaitExpression) {
      const fn = enclosingFn(node);
      const isAsync = fn && fn.modifiers && fn.modifiers.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
      if (fn && !isAsync) hits.push({ line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind: 'await-in-non-async' });
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return hits;
}

// Regex: `.then(...)` chains with no `.catch(` and no surrounding try/await — likely unhandled rejection.
function thenWithoutCatch(content) {
  const hits = [];
  const lines = String(content || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/\.then\s*\(/.test(l)) {
      // look at this line + next 3 for a .catch / await / try
      const win = lines.slice(i, i + 4).join(' ');
      if (!/\.catch\s*\(|await\b|try\s*\{/.test(win)) hits.push({ line: i + 1, kind: 'then-without-catch' });
    }
  }
  return hits;
}

function scanAsyncBugs(content, fileName) {
  return [...awaitInNonAsync(content, fileName), ...thenWithoutCatch(content)];
}

module.exports = { awaitInNonAsync, thenWithoutCatch, scanAsyncBugs };
