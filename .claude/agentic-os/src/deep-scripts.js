// src/deep-scripts.js
// Generate self-contained Workflow scripts with the file batches INLINED, so the orchestrator only
// ever runs Workflow({scriptPath}) — no giant batch args passed by hand. Two flavours:
//   genSweepScript     — the normal fan-out (reuses workflows/deep-extract-sweep.js, injects batches)
//   genReextractScript — for undercounting files: one agent per file + an explicit chunked-read plan
const fs = require('node:fs');
const path = require('node:path');

const SWEEP_TEMPLATE = path.join(__dirname, '..', 'workflows', 'deep-extract-sweep.js');

// Inject `batches` into the committed sweep workflow (replacing its args-parsing block).
function genSweepScript(batches, outPath) {
  let src = fs.readFileSync(SWEEP_TEMPLATE, 'utf8');
  const start = src.indexOf('// args: {');
  const endMarker = "let glossary = (parsedArgs && parsedArgs.glossary) || [];";
  const end = src.indexOf(endMarker) + endMarker.length;
  if (start === -1 || end < endMarker.length) throw new Error('sweep template markers not found');
  const inlined = `// INLINED batches (${batches.length} batches)\nconst batches = ${JSON.stringify(batches)};\nlet glossary = [];`;
  src = src.slice(0, start) + inlined + src.slice(end);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, src);
  return outPath;
}

// Re-extract workflow: each flagged file gets a solo agent + an explicit chunked-read plan computed
// from its line count, so it cannot skip the file tail (the cause of undercounts on large files).
function genReextractScript(files, outPath) {
  const script = `export const meta = {
  name: 'deep-reextract',
  description: 'Re-extract files that undercounted outbound API calls, with explicit per-file chunked-read plans.',
  phases: [{ title: 'Reextract' }],
};
const FILES = ${JSON.stringify(files)};
const DEEP_SKILL = \`You are the agentic-os deep-extract intelligence. Emit ONE JSON object per file with keys:
file, kind, purpose, connectionsOut[](type,target,method,params{query,body},detail,line,confidence),
exposesEndpoints[](type,id,method,params{query,body,path},guards,detail,line,confidence),
findings[](kind,note,line,confidence), discoveredConventions[](name,evidence,appliesTo),
selfCheck{exposesEndpointsCount,httpCallsOut,findingsCount}.
Spine is FIXED (type/target/method/params/detail/line/confidence — target not url, line not location).
CRITICAL: this file UNDERCOUNTED outbound calls. Find and emit EVERY network call (axios.*, axios(),
fetch/authFetch, httpService/httpClient) as a connectionsOut 'http-call' with target+method+params,
INCLUDING ones in private helpers, loops, Promise.all, and near the file END. selfCheck.httpCallsOut
MUST equal the number of http-call items. Also capture exposesEndpoints (routes+guards) + findings. JSON only.\`;
function chunkPlan(n){ const c=[]; for(let o=1;o<=n;o+=1500) c.push(\`Read(offset=\${o}, limit=1500)\`); return c; }
phase('Reextract');
const WAVE = 6; const all = []; let glossary = [];
for (let i=0;i<FILES.length;i+=WAVE){
  const wave=FILES.slice(i,i+WAVE);
  const res=await parallel(wave.map((file)=>()=>{
    const plan=chunkPlan(file.n||2000);
    const prompt=\`\${DEEP_SKILL}\\n\\n*** FILE IS \${file.n||'?'} LINES. Read the WHOLE file via these \${plan.length} call(s) IN ORDER:\\n\${plan.map((p,k)=>\`  \${k+1}. \${p}\`).join('\\n')}\\nDo NOT emit until you have read to the end. Capture EVERY network call. ***\\n\\nFile: \${file.f}\`;
    return agent(prompt,{schema:{type:'object',properties:{inventories:{type:'array',items:{type:'object'}},discoveredConventions:{type:'array',items:{type:'object'}}},required:['inventories']},label:file.f.split('/').pop(),phase:'Reextract',model:'sonnet'});
  }));
  for(const r of res.filter(Boolean)){ all.push(...(r.inventories||[])); for(const g of r.discoveredConventions||[]) if(g&&g.name&&!glossary.find((x)=>x.name===g.name)) glossary.push(g); }
}
log(\`re-extract: \${all.length} inventories\`);
return { inventories: all, glossary };
`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, script);
  return outPath;
}

module.exports = { genSweepScript, genReextractScript };
