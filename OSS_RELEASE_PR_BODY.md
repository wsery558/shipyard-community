# OSS Release PR Body

## Summary

This PR adds minimal continuous integration and polish to prepare the agent-dashboard-open repository for OSS release.

## What Changed

- **Added GitHub Actions CI** (`.github/workflows/ci.yml`)
  - Triggers: push and pull_request
  - Node.js 20.x runtime
  - Steps: checkout, setup-node, enable pnpm, install dependencies, build, test:smoke, lint, typecheck
  - All checks pass with current open-core behavior

- **Updated README.md**
  - Added CI badge at top linking to workflow status
  - Clarified default port **8788** for `pnpm start`
  - Documented smoke test ephemeral port default behavior (override with `SMOKE_PORT`)
  - Confirmed stubs are labeled in Scripts section (lint, typecheck, test:unit)

- **Created OSS_RELEASE_PR_BODY.md** (this file)
  - Serves as template for future release PRs
  - Documents verification steps and boundary reminders

## How to Verify

### Pre-merge verification (run all):

```bash
# 1. Confirm CI workflow file exists
test -f .github/workflows/ci.yml && echo "✅ CI workflow created"

# 2. Verify build and test:smoke steps are in workflow
rg -n "pnpm -s (build|test:smoke)" .github/workflows/ci.yml

# 3. Build UI
pnpm -s build

# 4. Run smoke tests (uses ephemeral port by default)
pnpm -s test:smoke

# 5. Lint check (permissive, warnings expected)
pnpm -s lint

# 6. Typecheck (stub for JS project)
pnpm -s typecheck

# 7. Check what files changed
git status --porcelain
```

Expected output:
- `ci.yml` exists and contains `pnpm -s build` and `pnpm -s test:smoke`
- Build completes with optional Vite chunk warnings
- Smoke reports: `✅ smoke: all checks passed`
- Lint exits 0 (warnings are OK)
- Typecheck prints stub message and exits 0
- Only `.github/workflows/ci.yml` and `README.md` appear as modified

### Manual verification (optional):

```bash
# Test default port 8788
PORT=8788 pnpm start &
sleep 3
curl -fsS http://127.0.0.1:8788/health
curl -fsS http://127.0.0.1:8788/api/state
curl -fsS http://127.0.0.1:8788/api/projects
pkill -f "node server.mjs"
```

All three endpoints must return HTTP 200.

## Open-Core Boundary Reminder

This build intentionally returns HTTP 501 for all paid/platform endpoints:

- `/api/compliance/passive`
- `/api/platform/auth/me`
- `/api/platform/entitlements`
- `/api/platform/admin/*`
- `/api/platform/events`
- `/api/platform/metrics`

This design is **intentional**. The open-core snapshot remains self-contained and does not invoke gated services. These 501 responses do not indicate errors.

## Notes

### Lint

- **Status**: Permissive, exits 0
- **Behavior**: Emits warnings over `.js`, `.mjs`, `.jsx` surface but passes CI
- **Note**: Some linting warnings are expected in this build

### Typecheck

- **Status**: Stub (JS project, no TypeScript)
- **Behavior**: Prints "No TypeScript typecheck (JS project)" and exits 0
- **Note**: This is intentional; the codebase is JavaScript

### Test Suite

- **test:smoke**: Real smoke tests validating /health, /api/state, /api/projects
- **test:unit**: Stub (prints "No unit tests in open-core snapshot")
- **test:integration**, **test:regression**: Available but not gated by CI

## No Runtime Changes

This PR **does not** modify:
- Server routes or orchestrator logic
- Open-core vs paid boundary behavior (501 list unchanged)
- Data stores or configuration
- API contract or payload shapes

All changes are CI + documentation only.

## CI Badge Reference

The badge in README.md points to the GitHub Actions workflow:

```markdown
[![CI](https://github.com/github/agent-dashboard-open/actions/workflows/ci.yml/badge.svg)](https://github.com/github/agent-dashboard-open/actions/workflows/ci.yml)
```

Update the repository URL in the badge if forking this repo.
