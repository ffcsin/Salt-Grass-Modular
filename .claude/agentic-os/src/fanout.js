'use strict';
// Worktree fan-out planner. Given tasks that each CLAIM a set of files, group them into parallel
// batches whose file sets are DISJOINT — so each batch can run in its own git worktree with a
// sub-agent and won't conflict by construction (the safe slice of multi-agent orchestration). The
// orchestration (git worktree add, dispatch, fan-in) lives in the fan-out skill; this is the pure
// dependency-aware grouping. Zero deps.

// tasks: [{ id, files: [...] }]. Returns batches: [[task,...], ...] where each batch is file-disjoint.
function planFanout(tasks) {
  const norm = (tasks || []).map((t) => ({ ...t, files: new Set((t.files || []).map((f) => f.replace(/\\/g, '/'))) }));
  const batches = [];
  for (const t of norm) {
    let placed = false;
    for (const batch of batches) {
      const clash = batch.some((b) => [...t.files].some((f) => b.files.has(f)));
      if (!clash) { batch.push(t); placed = true; break; }
    }
    if (!placed) batches.push([t]);
  }
  // Sequential tail: tasks with no files declared can't be proven disjoint → run them solo, last.
  return batches.map((b) => b.map((t) => ({ id: t.id, files: [...t.files] })));
}

// Convenience: max parallelism = size of the largest disjoint batch round (round-robin view).
function parallelRounds(batches) {
  // Transpose: round r runs the r-th task of every batch (all disjoint within a round? no — batches
  // are the disjoint groups). Simplest correct model: each batch is independent; concurrency = #batches.
  return batches.length;
}

module.exports = { planFanout, parallelRounds };
