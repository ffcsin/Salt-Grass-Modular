// src/ast/ts-extract.js
// Byte-deterministic AST extraction for TS/JS via the TypeScript compiler API (the research-ideal
// V0 reference — structural facts come from a parser, never an LLM). Extracts NestJS-style routes:
// @Controller('prefix') + @Get/@Post(...) methods, with @UseGuards and @Body/@Query/@Param params.
// OPTIONAL: callers should guard require() so the zero-dep core still runs if typescript is absent.
let ts;
try { ts = require('typescript'); } catch { ts = null; }
const { composePath } = require('../execute');

function available() { return !!ts; }

const getDecorators = (node) => (ts.getDecorators ? ts.getDecorators(node) : node.decorators) || [];
function decoratorName(dec) {
  const e = dec.expression;
  return (ts.isCallExpression(e) ? e.expression : e).getText().replace(/^@/, '');
}
function stringArg(dec, i = 0) {
  const e = dec.expression;
  if (ts.isCallExpression(e) && e.arguments[i] && ts.isStringLiteralLike(e.arguments[i])) return e.arguments[i].text;
  return undefined;
}
function guardNames(decs) {
  const g = decs.find((d) => decoratorName(d) === 'UseGuards');
  if (!g || !ts.isCallExpression(g.expression)) return [];
  return g.expression.arguments.map((a) => a.getText());
}
function paramShapes(method) {
  const q = [], b = [], p = [];
  for (const param of method.parameters || []) {
    for (const d of getDecorators(param)) {
      const n = decoratorName(d);
      const name = stringArg(d) || (param.name && param.name.getText && param.name.getText()) || '';
      if (n === 'Body') b.push(name); else if (n === 'Query') q.push(name); else if (n === 'Param') p.push(name);
    }
  }
  return { query: q, body: b, path: p };
}

const HTTP = new Set(['Get', 'Post', 'Put', 'Delete', 'Patch', 'All', 'Options', 'Head']);

// Extract routes from one TS/JS source string. Deterministic + complete for AST-visible decorators
// (multi-controller files, no-path decorators, multi-line decorators all handled — the regex pain points).
function extractTsRoutes(content, fileName = 'file.ts') {
  if (!ts) return [];
  const sf = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
  const routes = [];
  function visit(node) {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const classDecs = getDecorators(node);
      const ctrl = classDecs.find((d) => decoratorName(d) === 'Controller');
      if (ctrl !== undefined) {
        const prefix = stringArg(ctrl) || '';
        const classGuards = guardNames(classDecs);
        for (const member of node.members || []) {
          if (!ts.isMethodDeclaration(member)) continue;
          const mdecs = getDecorators(member);
          for (const d of mdecs) {
            const m = decoratorName(d);
            if (!HTTP.has(m)) continue;
            const route = composePath(prefix, stringArg(d) || '');
            routes.push({
              method: m.toUpperCase(), route,
              guards: [...classGuards, ...guardNames(mdecs)],
              params: paramShapes(member),
              line: sf.getLineAndCharacterOfPosition(member.getStart()).line + 1,
              handler: member.name ? member.name.getText() : '',
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return routes;
}

module.exports = { available, extractTsRoutes, decoratorName, guardNames };
