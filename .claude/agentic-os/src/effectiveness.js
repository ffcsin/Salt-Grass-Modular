'use strict';
// Agent-effectiveness metrics. Mines git history for the signals that matter (rework/churn — did the
// agent reduce effort or just shift work into review?). Acceptance rate alone is vanity; CHURN is the
// SOTA signal. Zero-dep: parses `git log` output passed in (the bin shells out to git).

// Parse `git log --format=%H|%an|%at --numstat` into commits with added/deleted line totals.
function parseNumstat(logText) {
  const commits = [];
  let cur = null;
  for (const line of String(logText || '').split('\n')) {
    const head = line.match(/^([0-9a-f]{6,40})\|([^|]*)\|(\d+)$/);
    if (head) { cur = { hash: head[1], author: head[2], ts: +head[3], added: 0, deleted: 0, files: 0 }; commits.push(cur); continue; }
    const ns = line.match(/^(\d+|-)\t(\d+|-)\t(.+)/);
    if (ns && cur) { cur.added += ns[1] === '-' ? 0 : +ns[1]; cur.deleted += ns[2] === '-' ? 0 : +ns[2]; cur.files++; }
  }
  return commits;
}

// Churn metrics over commits matching an author/marker (e.g. agent commits = Co-Authored-By Claude).
function churnMetrics(commits, { windowSecs = 7 * 24 * 3600 } = {}) {
  if (!commits.length) return { commits: 0, added: 0, deleted: 0, churnRatio: 0, reworkRatio: 0 };
  const added = commits.reduce((s, c) => s + c.added, 0);
  const deleted = commits.reduce((s, c) => s + c.deleted, 0);
  // rework proxy: deletions relative to additions (high = lots of rewriting earlier work)
  const churnRatio = added ? deleted / added : 0;
  // quick-revert proxy: commits whose deletions exceed additions (net-negative churn)
  const reverts = commits.filter((c) => c.deleted > c.added).length;
  return { commits: commits.length, added, deleted, churnRatio: +churnRatio.toFixed(3), reworkRatio: +(reverts / commits.length).toFixed(3), netLines: added - deleted };
}

function render(metrics) {
  return ['# Effectiveness metrics', '',
    `- Commits analyzed: ${metrics.commits}`,
    `- Lines added/deleted: +${metrics.added} / -${metrics.deleted} (net ${metrics.netLines})`,
    `- Churn ratio (deleted/added): ${metrics.churnRatio} ${metrics.churnRatio > 0.6 ? '⚠ high rewriting' : ''}`,
    `- Rework ratio (net-negative commits): ${(metrics.reworkRatio * 100).toFixed(0)}%`,
    '', '_Churn/rework are the real effectiveness signals — acceptance rate alone is vanity._'].join('\n');
}

module.exports = { parseNumstat, churnMetrics, render };
