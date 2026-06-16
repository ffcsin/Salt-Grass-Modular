// src/path-map.js
const { areaOf } = require('./group');

function dirOf(file) {
  const f = file.replace(/\\/g, '/');
  return f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.';
}

function pathMap(map) {
  const votes = {}; // dir -> { area: count }
  const fileVotes = {}; // file -> { area: count } (for heterogeneous one-file-per-feature dirs)
  const vote = (file, area) => {
    const d = dirOf(file);
    (votes[d] || (votes[d] = {}))[area] = (votes[d][area] || 0) + 1;
    const f = file.replace(/\\/g, '/');
    (fileVotes[f] || (fileVotes[f] = {}))[area] = (fileVotes[f][area] || 0) + 1;
  };
  for (const r of map.routes || []) vote(r.file, areaOf(r.route));
  for (const w of map.wireup || []) if (w.match === 'matched' && w.from) vote(w.from.file, areaOf(w.route));

  const top = (v) => Object.entries(v).sort((a, b) => b[1] - a[1])[0];
  const mappings = [];
  for (const [dir, v] of Object.entries(votes)) {
    const [area] = top(v);
    mappings.push({ glob: (dir === '.' ? '' : dir + '/') + '**', area, doc: `.ecosystem/areas/${area}.md` });
  }
  // A one-glob-per-dir mapping lies for one-file-per-feature layouts (e.g. trpc/routers/ holding 24
  // namespace files — the plurality winner is wrong for ~90% of files) and for lone outliers (a
  // webhook.ts inside payments/). Emit an exact-file mapping wherever a file's own winner differs
  // from its dir's; areaForFile's longest-prefix rule makes the file entry beat the dir glob.
  for (const [file, fv] of Object.entries(fileVotes)) {
    const [fa] = top(fv);
    const dirWinner = top(votes[dirOf(file)])[0];
    if (fa !== dirWinner) mappings.push({ glob: file, area: fa, doc: `.ecosystem/areas/${fa}.md` });
  }
  mappings.sort((a, b) => a.glob.localeCompare(b.glob));

  return { version: 1, generatedAt: new Date().toISOString(), mappings };
}

module.exports = { pathMap, dirOf };
