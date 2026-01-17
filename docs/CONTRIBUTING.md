# Contributing to Agent Dashboard

## Code Organization

Agent Dashboard uses a **mono-repository** structure to isolate open-core and paid-platform code:

```
packages/
  open-core/        ← 19 open-source modules
  paid-platform/    ← 3 commercial modules (stubbed in open release)
apps/
  dashboard/        ← React UI
```

### Open Core Modules

Core modules for workflow execution, budgeting, compliance, etc. in **packages/open-core/src/**.

All imports use relative paths:
```javascript
import { readCoreData } from './src/core.mjs';  // ✅ OK
import { something } from '../../packages/paid-platform/...';  // ❌ Never
```

### Adding Features to Open Core

1. Add new module to **packages/open-core/src/**
2. Export from **packages/open-core/src/index.mjs**
3. Test with `pnpm test:boundaries` to verify no paid-platform leakage
4. Run full suite: `pnpm test`

### Testing

```bash
# Run all tests (includes boundary check)
pnpm test

# Boundary check only
pnpm test:boundaries

# Unit tests
pnpm test:unit

# Smoke tests
pnpm test:smoke

# Audit open-core integrity
pnpm audit:open
```

### Git Workflow

1. Create feature branch from `main`
2. Make changes to open-core modules
3. Run `pnpm test` to verify
4. Open PR with clear description
5. After merge, boundary check runs on CI

### Open Release Packaging

To create a distribution tarball:

```bash
pnpm pack:open
```

This:
1. Audits for paid-platform code
2. Verifies all paid routes stubbed (501)
3. Creates tarball with only open-core
4. Includes OPEN_DELIVERY.md, LICENSE, SECURITY.md

Output: `agent-dashboard-open-v0.1.tar.gz`

### Release Notes

When creating an open-core release:

1. Update version in **package.json**
2. Document changes in **CHANGELOG.md**
3. Run `pnpm pack:open`
4. Verify tarball contents
5. Commit and tag:
   ```bash
   git tag open/v0.1
   git push origin open/v0.1
   ```

## Code Style

- ESM modules with `.mjs` extension
- JSDoc comments for exported functions
- No TypeScript (pure JavaScript)
- Use `const` and `let` only
- 2-space indentation

Example:
```javascript
/**
 * Calculate cost for project
 * @param {string} projectId
 * @param {Object} params
 * @returns {number} total cost
 */
export function calculateCost(projectId, params) {
  // Implementation
}
```

## Commit Messages

Use conventional commits:
```
feat(core): add new module X
fix(server): fix crash on Y
docs(delivery): update getting started
chore(boundaries): improve check script
```

## Questions?

See **OPEN_DELIVERY.md** for complete distribution guide.
