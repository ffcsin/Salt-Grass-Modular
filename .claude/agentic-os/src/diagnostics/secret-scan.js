'use strict';
// Secret-leak guard. Scans the content being WRITTEN (a diff, or a PreToolUse new_string) for
// credentials before they hit disk — provider-specific regexes + Shannon-entropy as a secondary
// signal for high-randomness strings. A reviewed-false-positive baseline suppresses known-safe hits.
// Gitleaks/detect-secrets approach, re-implemented zero-dep in Node. The repo's env-audit is a
// STATIC analysis; this is the WRITE-TIME gate.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RULES = [
  { id: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/, desc: 'AWS access key id' },
  { id: 'aws-secret', re: /\baws_secret_access_key\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i, desc: 'AWS secret access key' },
  { id: 'stripe-live', re: /\bsk_live_[0-9a-zA-Z]{16,}\b/, desc: 'Stripe live secret key' },
  { id: 'stripe-restricted', re: /\brk_live_[0-9a-zA-Z]{16,}\b/, desc: 'Stripe restricted key' },
  { id: 'github-pat', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, desc: 'GitHub token' },
  { id: 'gitlab-pat', re: /\bglpat-[A-Za-z0-9_-]{20,}\b/, desc: 'GitLab token' },
  { id: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, desc: 'Slack token' },
  { id: 'google-api', re: /\bAIza[0-9A-Za-z_-]{35}\b/, desc: 'Google API key' },
  { id: 'openai', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/, desc: 'OpenAI-style key' },
  { id: 'anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/, desc: 'Anthropic API key' },
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, desc: 'Private key block' },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, desc: 'JWT' },
  { id: 'mongodb-uri', re: /\bmongodb(?:\+srv)?:\/\/[^\s:'"@]+:[^\s:'"@]+@/, desc: 'MongoDB URI with credentials' },
  { id: 'postgres-uri', re: /\bpostgres(?:ql)?:\/\/[^\s:'"@]+:[^\s:'"@]+@/, desc: 'Postgres URI with credentials' },
  { id: 'generic-assign', re: /\b(?:api[_-]?key|secret|passwd|password|token|access[_-]?key|private[_-]?key)\s*[=:]\s*['"][^'"\s]{12,}['"]/i, desc: 'Hardcoded secret assignment' },
];

function shannon(s) {
  if (!s) return 0;
  const freq = {}; for (const c of s) freq[c] = (freq[c] || 0) + 1;
  let H = 0; const n = s.length;
  for (const c in freq) { const p = freq[c] / n; H -= p * Math.log2(p); }
  return H;
}

// High-entropy token: long, mixed, random-looking string assigned to a secret-ish name.
function entropyHits(text) {
  const hits = [];
  const re = /(?:['"]([A-Za-z0-9_\-+/=]{20,})['"])/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const tok = m[1];
    const H = shannon(tok);
    // entropy/length gate: base64-ish secrets land ~4.5-6 bits/char; words/paths land lower.
    if (H >= 4.0 && tok.length >= 24 && /[0-9]/.test(tok) && /[A-Za-z]/.test(tok) && !/\s/.test(tok) && !/^https?:/.test(tok)) {
      hits.push({ id: 'high-entropy', desc: `high-entropy string (H=${H.toFixed(2)})`, match: tok.slice(0, 6) + '…' });
    }
  }
  return hits;
}

function maskMatch(s) { return String(s).slice(0, 4) + '…' + String(s).slice(-2); }

// Core: scan a block of text. baseline = Set of fingerprints to suppress.
function scanSecrets(text, { baseline = new Set(), includeEntropy = true } = {}) {
  const out = [];
  const lines = String(text || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const rule of RULES) {
      const m = lines[i].match(rule.re);
      if (m) { const fp = fingerprint(rule.id, m[0]); if (!baseline.has(fp)) out.push({ rule: rule.id, desc: rule.desc, line: i + 1, match: maskMatch(m[0]), fingerprint: fp }); }
    }
  }
  if (includeEntropy) for (const e of entropyHits(text)) { const fp = fingerprint(e.id, e.match); if (!baseline.has(fp)) out.push({ rule: e.id, desc: e.desc, line: 0, match: e.match, fingerprint: fp }); }
  return out;
}

function fingerprint(ruleId, match) { return crypto.createHash('sha1').update(ruleId + '|' + match).digest('hex').slice(0, 16); }

function loadBaseline(root) {
  try { return new Set(JSON.parse(fs.readFileSync(path.join(root, '.ecosystem', 'secrets-baseline.json'), 'utf8'))); } catch { return new Set(); }
}

module.exports = { scanSecrets, shannon, entropyHits, fingerprint, loadBaseline, RULES };
