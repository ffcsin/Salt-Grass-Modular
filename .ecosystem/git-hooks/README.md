# agentic-os managed git hooks

This directory is the repo's `core.hooksPath` (set by `agentic-os install-git-hooks`).
`pre-push` runs `.ecosystem/ci-check.sh` before every push (lint/typecheck/test/dep-audit/
secret-scan). It BLOCKS the push on failure; bypass once with `AGENTIC_OS_OVERRIDE=1 git push`.

To stop using managed hooks: `git config --unset core.hooksPath`.
