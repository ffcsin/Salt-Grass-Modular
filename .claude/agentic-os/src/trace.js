'use strict';
// Run-trace timeline. Parses the session transcript (JSONL) into OpenTelemetry-GenAI-shaped spans
// (one per tool call / model turn) and renders a timeline — the "flight recorder" for a
// non-deterministic agent run (what it did, in what order, what it cost). Local + zero-dep; if an
// OTLP endpoint is configured the spans can be POSTed, but the default is a markdown timeline.

// Convert transcript entries to spans. Each tool_use / tool_result / assistant turn -> a span.
function transcriptToSpans(entries) {
  const spans = [];
  for (const e of entries || []) {
    const msg = e.message || e;
    const role = msg.role || e.type;
    const usage = msg.usage || {};
    if (Array.isArray(msg.content)) {
      for (const c of msg.content) {
        if (c.type === 'tool_use') spans.push({ kind: 'tool', name: c.name, attrs: { 'gen_ai.tool.name': c.name, args: truncate(c.input) }, ts: e.timestamp || '' });
        else if (c.type === 'text' && role === 'assistant') spans.push({ kind: 'model', name: 'assistant.message', attrs: { 'gen_ai.usage.input_tokens': usage.input_tokens || 0, 'gen_ai.usage.output_tokens': usage.output_tokens || 0 }, ts: e.timestamp || '' });
      }
    } else if (role === 'assistant') {
      spans.push({ kind: 'model', name: 'assistant.message', attrs: { 'gen_ai.usage.output_tokens': usage.output_tokens || 0 }, ts: e.timestamp || '' });
    }
  }
  return spans;
}

function truncate(o) { try { const s = JSON.stringify(o); return s.length > 120 ? s.slice(0, 120) + '…' : s; } catch { return ''; } }

function renderTimeline(spans) {
  const lines = ['# Run trace (timeline)', '', `_${spans.length} span(s). OTel-GenAI shaped._`, ''];
  const toolCounts = {};
  for (const s of spans) {
    if (s.kind === 'tool') { toolCounts[s.name] = (toolCounts[s.name] || 0) + 1; lines.push(`- 🔧 ${s.name} ${s.attrs.args || ''}`); }
    else lines.push(`- 💬 ${s.name} (out: ${s.attrs['gen_ai.usage.output_tokens'] || 0} tok)`);
  }
  lines.push('', '## Tool usage', ...Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).map(([n, c]) => `- ${n}: ${c}`));
  return lines.join('\n');
}

module.exports = { transcriptToSpans, renderTimeline };
