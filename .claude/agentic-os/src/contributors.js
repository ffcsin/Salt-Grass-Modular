// src/contributors.js
// Build per-author, public-safe contributor profiles from git history (the "who owns what / who
// touched this" layer — an established pattern). Pure parser + an FS entry. No private data: name + the
// areas/dirs they touch most + recent activity counts. Identity secrets stay out (user-profile job).
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Parse `git log --format=%an|%ae|%H --name-only` output into per-author aggregates.
function parseGitLog(text) {
  const authors = {};
  let cur = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trimEnd();
    if (line.includes('|') && line.split('|').length >= 3) {
      const [name, email, hash] = line.split('|');
      const key = (email || name || '').toLowerCase();
      cur = authors[key] || (authors[key] = { name, email, commits: 0, files: new Set(), dirs: {} });
      cur.commits++;
      cur._hash = hash;
    } else if (line && cur && !line.startsWith('|')) {
      cur.files.add(line);
      const dir = line.split('/').slice(0, 2).join('/');
      cur.dirs[dir] = (cur.dirs[dir] || 0) + 1;
    }
  }
  return Object.values(authors).map((a) => ({
    name: a.name, email: a.email, commits: a.commits, fileCount: a.files.size,
    topAreas: Object.entries(a.dirs).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([d, n]) => ({ area: d, touches: n })),
  })).sort((x, y) => y.commits - x.commits);
}

const slug = (s) => String(s || 'unknown').replace(/[^a-z0-9._-]/gi, '-').toLowerCase();

function profileMarkdown(a) {
  return [
    `# ${a.name}`, '',
    `_${a.commits} commits · ${a.fileCount} files touched (machine-generated from git history; public-safe)._`, '',
    '## Ownership (most-touched areas)', '',
    ...a.topAreas.map((t) => `- \`${t.area}\` — ${t.touches} touches`),
    '', '_Identity/preferences live in the local user profile (outside the repo), not here._',
  ].join('\n') + '\n';
}

// FS entry: read git history, write .ecosystem/contributors/<handle>.md per author + an index.
function buildContributors(root, opts = {}) {
  let log = '';
  try { log = execSync(`git log --since="${opts.since || '1 year ago'}" --format=%an|%ae|%H --name-only`, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch { return { authors: [], written: [] }; }
  const authors = parseGitLog(log);
  const dir = path.join(root, '.ecosystem', 'contributors');
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  for (const a of authors) { const f = `${slug(a.name)}.md`; fs.writeFileSync(path.join(dir, f), profileMarkdown(a)); written.push(f); }
  fs.writeFileSync(path.join(dir, 'index.md'), ['# Contributors', '', ...authors.map((a) => `- [${a.name}](${slug(a.name)}.md) — ${a.commits} commits`)].join('\n') + '\n');
  return { authors, written };
}

module.exports = { parseGitLog, profileMarkdown, buildContributors };
