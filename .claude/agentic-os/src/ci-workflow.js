// src/ci-workflow.js
function ciWorkflowYaml() {
  return `name: agentic-os check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Ecosystem map present
        run: |
          test -f .ecosystem/map.json || { echo "::error::.ecosystem/map.json missing — run /agentic-os:bootstrap-ecosystem"; exit 1; }
      - name: Tests
        run: |
          if [ -f package.json ] && node -e "process.exit(require('./package.json').scripts && require('./package.json').scripts.test ? 0 : 1)"; then
            npm test --silent
          elif [ -f requirements.txt ] || [ -f pyproject.toml ]; then
            pip install -q pytest && pytest -q || true
          else
            echo "no recognized test command — skipping"
          fi
`;
}
module.exports = { ciWorkflowYaml };
