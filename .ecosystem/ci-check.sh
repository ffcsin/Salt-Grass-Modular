#!/usr/bin/env bash
# agentic-os checks (deterministic:static-site-generator). BLOCK tier fails the run; ADVISORY tier is reported only.
set -uo pipefail
FAILED=();
run_block() { echo "── [block] $1"; bash -c "$2"; if [ $? -ne 0 ]; then FAILED+=("$1"); fi; }
run_adv()   { echo "── [advisory] $1"; bash -c "$2" || echo "  ⚠ advisory '$1' failed (not blocking)"; }
run_block "build" "npm run build"
run_block "secret-scan" "git diff --no-color | grep -nE 'sk-ant-[a-zA-Z0-9-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(ql)?://[^[:space:]:@]+:[^[:space:]:@]+@' && { echo 'secret detected'; exit 1; } || echo 'no secrets'"
run_adv "lint" "npm run lint"
run_adv "typecheck" "npx --no-install tsc --noEmit"
run_adv "dep-audit" "npm audit --audit-level=high"
if [ ${#FAILED[@]} -ne 0 ]; then echo "❌ BLOCK gates failed: ${FAILED[*]}"; exit 1; fi
echo "✅ all BLOCK gates passed"
