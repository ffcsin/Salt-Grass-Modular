'use strict';
// Per-edit error-check — the fast inner loop that catches obvious breakage on EVERY edit (the
// per-edit critique the owner wants). Tiered + fail-soft + single-file (never a repo-wide typecheck):
//   Tier 0  balance/JSON  — pure JS, ~ms, runs always (catches an Edit that left an unclosed block).
//   Tier 1  parse check   — `node --check` (.js/.cjs/.mjs) or `py_compile` (.py), file-scoped, timeout-bounded.
// It NEVER blocks — it only returns an error string the hook surfaces as context so the agent self-corrects
// in the same turn. The thorough cross-file critique stays at preflight; this is the cheap syntax gate.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CODE = /\.(ts|tsx|js|jsx|cjs|mjs)$/;
const IGNORE = /(^|[\\/])(node_modules|\.next|\.nuxt|dist|build|coverage|\.ecosystem|\.git|\.vercel|\.turbo|out)[\\/]/;
// Keywords after which a `/` begins a REGEX literal, not division.
const REGEX_KW = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'case', 'do', 'else']);
const WORD = /[A-Za-z0-9_$]/;
const JSX = /<[A-Za-z][\w-]*(\s|\/|>)/; // crude JSX/HTML-tag sniff — node --check can't parse these

function shouldCheck(rel) {
  const r = String(rel || '').replace(/\\/g, '/');
  if (!r || IGNORE.test(r)) return false;
  return CODE.test(r) || r.endsWith('.json');
}

// Tier 0 — JSON validity + bracket balance. Understands JS strings, template literals WITH `${}`
// interpolation (incl. nesting), line/block comments, AND regex literals (the `/.../ ` form, with its
// own quotes/brackets that must NOT be counted). Without regex/template awareness this false-positives
// on ordinary code (a regex containing `'` or a nested template) — so the scanner tracks both.
function balanceCheck(src, ext) {
  if (ext === '.json') { try { JSON.parse(src); return null; } catch (e) { return `invalid JSON: ${e.message}`; } }
  const s = String(src || '');
  const stack = []; const pairs = { ')': '(', ']': '[', '}': '{' };
  let i = 0, line = 1;
  let mode = 'code'; // code | line | block | sq | dq | tpl | re
  let inClass = false;          // inside a regex [...] char class (a `/` there does NOT end the regex)
  let lastSig = '', lastWord = '', curWord = '';
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (c === '\n') line++;
    if (mode === 'line') { if (c === '\n') mode = 'code'; i++; continue; }
    if (mode === 'block') { if (c === '*' && n === '/') { mode = 'code'; i += 2; continue; } i++; continue; }
    if (mode === 'sq') { if (c === '\\') { i += 2; continue; } if (c === "'") { mode = 'code'; lastSig = "'"; } i++; continue; }
    if (mode === 'dq') { if (c === '\\') { i += 2; continue; } if (c === '"') { mode = 'code'; lastSig = '"'; } i++; continue; }
    if (mode === 'tpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { mode = 'code'; lastSig = '`'; i++; continue; }
      if (c === '$' && n === '{') { stack.push({ c: '{', line, tpl: true }); mode = 'code'; i += 2; continue; } // ${…} → code
      i++; continue;
    }
    if (mode === 're') {
      if (c === '\\') { i += 2; continue; }
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) { mode = 'code'; lastSig = '/'; i++; while (i < s.length && /[a-z]/i.test(s[i])) i++; continue; }
      else if (c === '\n') { mode = 'code'; } // unterminated regex — recover
      i++; continue;
    }
    // code mode
    if (c === '/' && n === '/') { mode = 'line'; i += 2; continue; }
    if (c === '/' && n === '*') { mode = 'block'; i += 2; continue; }
    if (c === '/') {
      let div;
      if (WORD.test(lastSig)) div = !REGEX_KW.has(lastWord);   // ident/number → divide unless keyword
      else if (")]}'\"`".includes(lastSig)) div = true;         // value-producing close → divide
      else div = false;                                          // operator / open-bracket / comma → regex
      if (!div) { mode = 're'; inClass = false; curWord = ''; i++; continue; }
      lastSig = '/'; curWord = ''; i++; continue;
    }
    if (c === "'") { mode = 'sq'; curWord = ''; i++; continue; }
    if (c === '"') { mode = 'dq'; curWord = ''; i++; continue; }
    if (c === '`') { mode = 'tpl'; curWord = ''; i++; continue; }
    if (WORD.test(c)) { curWord += c; lastWord = curWord; lastSig = c; i++; continue; }
    curWord = '';
    if (c === '(' || c === '[' || c === '{') { stack.push({ c, line }); lastSig = c; i++; continue; }
    if (c === ')' || c === ']' || c === '}') {
      const top = stack.pop();
      if (!top || top.c !== pairs[c]) return `unbalanced \`${c}\` near line ${line}${top ? ` (opened \`${top.c}\` at line ${top.line})` : ''}`;
      if (top.tpl) { mode = 'tpl'; i++; continue; } // closing a ${…} → back into the template string
      lastSig = c; i++; continue;
    }
    if (!/\s/.test(c)) lastSig = c;
    i++;
  }
  if (mode === 're') return null; // unterminated regex usually means our own div/regex mis-detection — stay quiet
  if (mode === 'tpl') return 'unterminated template literal (`)'; // backticks are unambiguous → a real error
  if (mode === 'block') return 'unterminated block comment (/* …)';
  if (stack.length) { const t = stack[stack.length - 1]; return `unclosed \`${t.c}\` opened at line ${t.line}`; }
  return null;
}

let _nodeOk = null;
function parseCheck(absFile, ext, timeoutMs = 1500) {
  try {
    if (ext === '.js' || ext === '.cjs' || ext === '.mjs') {
      if (_nodeOk === null) { try { execFileSync(process.execPath, ['--version'], { stdio: 'ignore' }); _nodeOk = true; } catch { _nodeOk = false; } }
      if (!_nodeOk) return null;
      try { execFileSync(process.execPath, ['--check', absFile], { stdio: ['ignore', 'ignore', 'pipe'], timeout: timeoutMs }); return null; }
      catch (e) { const msg = String(e.stderr || e.message || '').split('\n').find((l) => /SyntaxError|Error:/.test(l)); return msg ? msg.trim().slice(0, 200) : null; }
    }
    if (ext === '.py') {
      try { execFileSync('python', ['-m', 'py_compile', absFile], { stdio: ['ignore', 'ignore', 'pipe'], timeout: timeoutMs }); return null; }
      catch (e) { const msg = String(e.stderr || e.message || '').split('\n').find((l) => /Error/.test(l)); return msg ? msg.trim().slice(0, 200) : null; }
    }
  } catch { return null; } // fail-soft: a missing tool / timeout never reports a false error
  return null;
}

// Orchestrate the tiers for one edited file. Returns an error string or null. Never throws.
function checkFile(root, relOrAbs, content) {
  try {
    const rel = path.isAbsolute(relOrAbs) ? path.relative(root, relOrAbs).replace(/\\/g, '/') : relOrAbs;
    if (!shouldCheck(rel)) return null;
    const abs = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(root, relOrAbs);
    const ext = path.extname(rel).toLowerCase();
    let src = content;
    if (src == null) { try { src = fs.readFileSync(abs, 'utf8'); } catch { return null; } }
    // For plain (non-JSX) JS on disk, `node --check` is the AUTHORITATIVE parser — it handles regex,
    // templates, and every edge the byte scanner only approximates, so trust it and skip the heuristic.
    const plainJs = ext === '.js' || ext === '.cjs' || ext === '.mjs';
    if (plainJs && !JSX.test(src) && fs.existsSync(abs)) return parseCheck(abs, ext);
    // TS/TSX/JSX/JSON or off-disk → heuristic balance (node --check can't parse TS/JSX).
    return balanceCheck(src, ext);
  } catch { return null; }
}

module.exports = { shouldCheck, balanceCheck, parseCheck, checkFile, CODE };
