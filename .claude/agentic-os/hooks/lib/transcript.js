const fs = require('node:fs');
function readLines(p) {
  try { return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); }
  catch { return []; }
}
function contentOf(entry) {
  const m = entry.message || entry;
  const role = m.role || entry.type;
  return { role, content: Array.isArray(m.content) ? m.content : [] };
}
function lastAssistantText(transcriptPath) {
  const lines = readLines(transcriptPath);
  for (let i = lines.length - 1; i >= 0; i--) {
    const { role, content } = contentOf(lines[i]);
    if (role === 'assistant') {
      const txt = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      if (txt) return txt;
    }
  }
  return '';
}
// All assistant text in the transcript (for marker-scrape auto-learning — a LEARNING(...) marker may
// appear in any turn, not just the last). Capped to the recent tail to bound work.
function allAssistantText(transcriptPath, lastN = 40) {
  const lines = readLines(transcriptPath);
  const texts = [];
  for (const entry of lines) {
    const { role, content } = contentOf(entry);
    if (role !== 'assistant') continue;
    const txt = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    if (txt) texts.push(txt);
  }
  return texts.slice(-lastN).join('\n');
}
function recentToolCalls(transcriptPath, n = 200) {
  const lines = readLines(transcriptPath);
  const calls = [];
  for (const entry of lines) {
    const { content } = contentOf(entry);
    // ms timestamp (unparseable → 0 = "old/unknown", never a false-recent — review M1).
    const ts = Date.parse((entry.message && entry.message.timestamp) || entry.timestamp || '') || 0;
    for (const c of content) {
      if (c.type === 'tool_use') {
        const inp = c.input || {};
        // desc = a Task/subagent's intent (description/prompt) — needed to confirm a Task was a REVIEW,
        // not just any subagent (review H1: "any Task satisfied the gate").
        const desc = inp.description || inp.prompt || '';
        calls.push({ name: c.name, command: inp.command, skill: inp.skill || inp.name, desc: String(desc).slice(0, 400), ts });
      }
    }
  }
  return calls.slice(-n);
}
module.exports = { lastAssistantText, allAssistantText, recentToolCalls };
