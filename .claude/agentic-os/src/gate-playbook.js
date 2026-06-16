'use strict';
// AUTO-GENERATED from docs/gates/ (the gate-playbook-research synthesis). The per-archetype two-tier gate
// reference + detect→archetype routing. Two consumers:
//   • resolveGates() (gate-config.js) — STACK-AWARE deterministic tiering: which gate categories are BLOCK
//     vs ADVISORY for the detected archetype (a Next.js app's build is deploy-critical → block; a library's
//     too; a slow backend image build → advisory). Falls back to a generic split if the archetype is unknown.
//   • the design-gates skill — cites docs/gates/<archetype>.md prose; this is the structured mirror.
// Regenerate by re-running the research workflow + the generator. Edit docs/gates/ for prose.

const PLAYBOOK = {
  "published-library": {
    "deployModel": "No deploy.",
    "block": [
      {
        "name": "production-build",
        "command": "npm run build",
        "category": "build"
      },
      {
        "name": "format-check",
        "command": "npx prettier --check .",
        "category": "format"
      },
      {
        "name": "unit-tests",
        "command": "npm test -- --run",
        "category": "test"
      },
      {
        "name": "publishable-artifact-lint",
        "command": "npx -y publint --strict",
        "category": "build"
      },
      {
        "name": "type-declaration-correctness",
        "command": "npx -y @arethetypeswrong/cli --pack",
        "category": "build"
      },
      {
        "name": "secret-scan",
        "command": "gitleaks protect --staged --redact --no-banner",
        "category": "security"
      }
    ],
    "advisory": [
      {
        "name": "strict-typecheck",
        "command": "npx tsc --noEmit",
        "category": "typecheck"
      },
      {
        "name": "lint",
        "command": "npx eslint . --max-warnings=0",
        "category": "lint"
      },
      {
        "name": "dep-audit",
        "command": "npm audit --omit=dev --audit-level=high",
        "category": "security"
      },
      {
        "name": "coverage",
        "command": "npm test -- --run --coverage",
        "category": "test"
      },
      {
        "name": "full-history-secret-scan",
        "command": "gitleaks detect --redact --no-banner",
        "category": "security"
      }
    ]
  },
  "ssr-web-app": {
    "deployModel": "Git-push-to-deploy on a Vercel-style host: pushing the production branch makes the host run `next build` and promote the output (SSR/ISR functions + static/edge assets).",
    "block": [
      {
        "name": "production-build",
        "command": "next build",
        "category": "build"
      },
      {
        "name": "lockfile-install",
        "command": "npm ci",
        "category": "build"
      },
      {
        "name": "format-check",
        "command": "prettier --check .",
        "category": "format"
      },
      {
        "name": "unit-tests",
        "command": "jest --ci --runInBand",
        "category": "test"
      },
      {
        "name": "secret-scan",
        "command": "gitleaks protect --staged --redact --no-banner",
        "category": "security"
      }
    ],
    "advisory": [
      {
        "name": "typecheck",
        "command": "npx tsc --noEmit -p apps/web/tsconfig.json",
        "category": "typecheck"
      },
      {
        "name": "lint",
        "command": "npx eslint . --max-warnings=0",
        "category": "lint"
      },
      {
        "name": "dep-audit",
        "command": "npm audit --omit=dev --audit-level=high",
        "category": "security"
      },
      {
        "name": "e2e-tests",
        "command": "playwright test",
        "category": "test"
      }
    ]
  },
  "spa-static-frontend": {
    "deployModel": "Static asset host / CDN (Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3+CloudFront).",
    "block": [
      {
        "name": "production-build",
        "command": "npm run build",
        "category": "build"
      },
      {
        "name": "format-check",
        "command": "npx prettier --check .",
        "category": "format"
      },
      {
        "name": "lint-errors",
        "command": "npx eslint . --max-warnings=0",
        "category": "lint"
      },
      {
        "name": "unit-tests",
        "command": "npx vitest run",
        "category": "test"
      },
      {
        "name": "secret-scan",
        "command": "gitleaks detect --no-banner --redact --exit-code 1",
        "category": "security"
      }
    ],
    "advisory": [
      {
        "name": "strict-typecheck",
        "command": "npx tsc --noEmit",
        "category": "typecheck"
      },
      {
        "name": "lint-warnings",
        "command": "npx eslint . --format=stylish",
        "category": "lint"
      },
      {
        "name": "dep-audit",
        "command": "npm audit --omit=dev --audit-level=high",
        "category": "security"
      },
      {
        "name": "coverage",
        "command": "npx vitest run --coverage",
        "category": "test"
      }
    ]
  },
  "node-backend-container": {
    "deployModel": "Container image built from the repo (Dockerfile or buildpack) and run as a long-lived service on Railway / Fly.",
    "block": [
      {
        "name": "production-build",
        "command": "npm run build",
        "category": "build"
      },
      {
        "name": "deps-install-frozen",
        "command": "npm ci",
        "category": "build"
      },
      {
        "name": "format-check",
        "command": "npx prettier --check .",
        "category": "format"
      },
      {
        "name": "lint",
        "command": "npx eslint . --max-warnings=0",
        "category": "lint"
      },
      {
        "name": "unit-tests",
        "command": "npm test -- --ci",
        "category": "test"
      },
      {
        "name": "secret-scan",
        "command": "gitleaks protect --staged --redact --no-banner",
        "category": "security"
      }
    ],
    "advisory": [
      {
        "name": "strict-typecheck",
        "command": "npx tsc --noEmit -p tsconfig.json",
        "category": "typecheck"
      },
      {
        "name": "integration-tests",
        "command": "npm run test:e2e",
        "category": "test"
      },
      {
        "name": "dep-audit",
        "command": "npm audit --audit-level=high --omit=dev",
        "category": "security"
      },
      {
        "name": "deep-secret-scan",
        "command": "trufflehog git file://. --since-commit HEAD --only-verified --fail",
        "category": "security"
      }
    ]
  },
  "python-web-service": {
    "deployModel": "Container image deploy.",
    "block": [
      {
        "name": "docker-build",
        "command": "docker build -t app:ci --target production .",
        "category": "build"
      },
      {
        "name": "ruff-format",
        "command": "ruff format --check .",
        "category": "format"
      },
      {
        "name": "ruff-lint",
        "command": "ruff check --output-format=github .",
        "category": "lint"
      },
      {
        "name": "pytest",
        "command": "pytest -q --maxfail=1 -p no:cacheprovider",
        "category": "test"
      },
      {
        "name": "dep-audit",
        "command": "pip-audit --strict --requirement requirements.txt",
        "category": "security"
      },
      {
        "name": "secret-scan",
        "command": "gitleaks detect --redact --no-banner --exit-code 1",
        "category": "security"
      }
    ],
    "advisory": [
      {
        "name": "mypy",
        "command": "mypy --pretty .",
        "category": "typecheck"
      },
      {
        "name": "coverage",
        "command": "pytest --cov --cov-report=term-missing",
        "category": "test"
      },
      {
        "name": "bandit",
        "command": "bandit -r . -ll -x tests",
        "category": "security"
      },
      {
        "name": "image-cve-scan",
        "command": "trivy image --severity HIGH,CRITICAL app:ci",
        "category": "security"
      }
    ]
  },
  "go-service": {
    "deployModel": "Compiled static binary shipped in a container.",
    "block": [
      {
        "name": "go-build",
        "command": "go build ./...",
        "category": "build"
      },
      {
        "name": "gofmt-check",
        "command": "test -z \"$(gofmt -l .)\"",
        "category": "format"
      },
      {
        "name": "go-mod-tidy-check",
        "command": "go mod tidy && git diff --exit-code go.mod go.sum",
        "category": "lint"
      },
      {
        "name": "go-vet",
        "command": "go vet ./...",
        "category": "lint"
      },
      {
        "name": "unit-tests",
        "command": "go test ./...",
        "category": "test"
      },
      {
        "name": "secret-scan",
        "command": "gitleaks protect --staged --redact --no-banner",
        "category": "security"
      }
    ],
    "advisory": [
      {
        "name": "golangci-lint",
        "command": "golangci-lint run ./...",
        "category": "lint"
      },
      {
        "name": "go-test-race",
        "command": "go test -race ./...",
        "category": "test"
      },
      {
        "name": "govulncheck",
        "command": "govulncheck ./...",
        "category": "security"
      },
      {
        "name": "gosec",
        "command": "gosec ./...",
        "category": "security"
      },
      {
        "name": "container-image-build",
        "command": "docker build -t app:$GIT_SHA .",
        "category": "build"
      }
    ]
  },
  "ruby-rails-app": {
    "deployModel": "Container/server deploy, predominantly Kamal (Rails 8 default) to a VPS/Docker host, or Heroku/Capistrano on older apps.",
    "block": [
      {
        "name": "test-suite",
        "command": "bundle exec rspec --format progress",
        "category": "test"
      },
      {
        "name": "rubocop",
        "command": "bundle exec rubocop --parallel --format github",
        "category": "lint"
      },
      {
        "name": "brakeman",
        "command": "bundle exec brakeman --no-pager -q -w2",
        "category": "security"
      },
      {
        "name": "gem-audit",
        "command": "bundle exec bundle-audit check --update",
        "category": "security"
      },
      {
        "name": "js-audit",
        "command": "bin/importmap audit",
        "category": "security"
      },
      {
        "name": "schema-consistency",
        "command": "bin/rails db:prepare && git diff --exit-code db/schema.rb",
        "category": "build"
      },
      {
        "name": "secret-scan",
        "command": "gitleaks detect --redact --no-banner --exit-code 1",
        "category": "security"
      }
    ],
    "advisory": [
      {
        "name": "asset-precompile",
        "command": "RAILS_ENV=production SECRET_KEY_BASE_DUMMY=1 bin/rails assets:precompile",
        "category": "build"
      },
      {
        "name": "system-tests",
        "command": "bin/rails test:system",
        "category": "test"
      },
      {
        "name": "strict-rubocop",
        "command": "bundle exec rubocop --only Metrics,Rails,Performance --format github",
        "category": "lint"
      },
      {
        "name": "verified-secret-history",
        "command": "trufflehog git file://. --only-verified --since-commit HEAD~50",
        "category": "security"
      }
    ]
  },
  "static-site-generator": {
    "deployModel": "Host-driven static deploy: a push to the default branch triggers the platform (Vercel/Netlify/Cloudflare Pages/GitHub Pages) to run the exact production BUILD command (`astro build`, `hugo --minify`, `eleventy`, static `vite build`) and publish the emitted output dir (dist/ or public/).",
    "block": [
      {
        "name": "production-build",
        "command": "npm run build",
        "category": "build"
      },
      {
        "name": "format-check",
        "command": "npx prettier --check .",
        "category": "format"
      },
      {
        "name": "secret-scan",
        "command": "gitleaks detect --no-banner --redact --source .",
        "category": "security"
      }
    ],
    "advisory": [
      {
        "name": "typecheck",
        "command": "npm run check",
        "category": "typecheck"
      },
      {
        "name": "lint",
        "command": "npm run lint",
        "category": "lint"
      },
      {
        "name": "unit-tests",
        "command": "npm test",
        "category": "test"
      },
      {
        "name": "e2e-tests",
        "command": "npx playwright test",
        "category": "test"
      },
      {
        "name": "dep-audit",
        "command": "npm audit --omit=dev --audit-level=high",
        "category": "security"
      }
    ]
  },
  "rust-cargo-service": {
    "deployModel": "Cargo compiles to a self-contained native artifact.",
    "block": [
      {
        "name": "cargo-build-release",
        "command": "cargo build --release --locked --all-targets",
        "category": "build"
      },
      {
        "name": "cargo-fmt-check",
        "command": "cargo fmt --all -- --check",
        "category": "format"
      },
      {
        "name": "cargo-check",
        "command": "cargo check --workspace --all-targets --all-features --locked",
        "category": "typecheck"
      },
      {
        "name": "cargo-test",
        "command": "cargo test --workspace --locked --all-features",
        "category": "test"
      },
      {
        "name": "cargo-deny",
        "command": "cargo deny check advisories bans sources",
        "category": "security"
      },
      {
        "name": "secret-scan",
        "command": "gitleaks protect --staged --redact --no-banner",
        "category": "security"
      }
    ],
    "advisory": [
      {
        "name": "cargo-clippy",
        "command": "cargo clippy --workspace --all-targets --all-features -- -D warnings",
        "category": "lint"
      },
      {
        "name": "cargo-audit",
        "command": "cargo audit --deny warnings",
        "category": "security"
      },
      {
        "name": "cargo-deny-licenses",
        "command": "cargo deny check licenses",
        "category": "security"
      },
      {
        "name": "cargo-doc",
        "command": "RUSTDOCFLAGS=\"-D warnings\" cargo doc --workspace --no-deps --all-features",
        "category": "build"
      }
    ]
  }
};

// Route a detect() result to an archetype. Ordering matters (per the research detectMapping): SSR (next)
// before SPA (react/vue/…); a server framework with no UI framework → backend; language fallbacks last.
function archetypeFor(detect) {
  detect = detect || {};
  const fw = new Set(detect.frameworks || []);
  const langs = new Set(detect.languages || []);
  if (fw.has('nextjs')) return 'ssr-web-app';
  if (fw.has('nestjs') || fw.has('express') || fw.has('fastify') || fw.has('koa')) return 'node-backend-container';
  if (detect.staticSite) return 'static-site-generator';
  if (fw.has('react') || fw.has('vue') || fw.has('svelte') || fw.has('angular')) return 'spa-static-frontend';
  if (fw.has('fastapi') || fw.has('django') || fw.has('flask')) return 'python-web-service';
  if (fw.has('rails')) return 'ruby-rails-app';
  if (langs.has('rust')) return 'rust-cargo-service';
  if (langs.has('go')) return 'go-service';
  if (detect.isLibrary) return 'published-library';
  if (langs.has('javascript')) return 'published-library'; // JS with no app framework → most likely a lib/tool
  if (langs.has('ruby')) return 'ruby-rails-app';
  return null;
}

// The gate categories that are BLOCK for an archetype (everything else → advisory). Derived from the
// research block tier. Used by resolveGates to tier the detected tooling by archetype.
function blockCategoriesFor(archetype) {
  const a = PLAYBOOK[archetype];
  if (!a) return null; // unknown → caller uses its generic default
  return new Set(a.block.map((g) => g.category).filter(Boolean));
}

module.exports = { PLAYBOOK, archetypeFor, blockCategoriesFor };
