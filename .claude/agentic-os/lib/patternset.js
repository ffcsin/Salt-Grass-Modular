// lib/patternset.js
const REQUIRED_ARRAYS = ['feCallPatterns', 'routePatterns', 'surfacePatterns'];

function validatePatternSet(ps) {
  const errors = [];
  if (!ps || typeof ps !== 'object') return { ok: false, errors: ['PatternSet is not an object'] };
  if (ps.version !== 1) errors.push('version must be 1');
  if (!ps.stack || typeof ps.stack !== 'object') errors.push('stack is required');
  if (!ps.fileGlobs || typeof ps.fileGlobs !== 'object') errors.push('fileGlobs is required');

  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(ps[key])) { errors.push(`${key} must be an array`); continue; }
    ps[key].forEach((p, i) => {
      if (typeof p.regex !== 'string') { errors.push(`${key}[${i}].regex must be a string`); return; }
      try { new RegExp(p.regex, p.flags || ''); }
      catch (e) { errors.push(`${key}[${i}] invalid regex: ${e.message}`); }
    });
  }
  // Optional: routePrefixPatterns (e.g. NestJS @Controller base). Validate regexes if present.
  if (ps.routePrefixPatterns !== undefined) {
    if (!Array.isArray(ps.routePrefixPatterns)) { errors.push('routePrefixPatterns must be an array'); }
    else ps.routePrefixPatterns.forEach((p, i) => {
      if (typeof p.regex !== 'string') { errors.push(`routePrefixPatterns[${i}].regex must be a string`); return; }
      try { new RegExp(p.regex, p.flags || ''); }
      catch (e) { errors.push(`routePrefixPatterns[${i}] invalid regex: ${e.message}`); }
    });
  }
  // Optional: fileRoutes (file-based routing dirs, e.g. Next.js pages-api). Each needs a baseDir.
  if (ps.fileRoutes !== undefined) {
    if (!Array.isArray(ps.fileRoutes)) { errors.push('fileRoutes must be an array'); }
    else ps.fileRoutes.forEach((fr, i) => {
      if (!fr || typeof fr.baseDir !== 'string' || !fr.baseDir) errors.push(`fileRoutes[${i}].baseDir must be a non-empty string`);
      if (fr && fr.exts !== undefined && !Array.isArray(fr.exts)) errors.push(`fileRoutes[${i}].exts must be an array`);
    });
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { validatePatternSet };
