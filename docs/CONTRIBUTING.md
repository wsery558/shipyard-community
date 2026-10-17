# Contributing to Shipyard Community

## Code Organization

Shipyard Community uses a **mono-repository** structure to isolate open-core and paid-platform code:

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
2. Export from **packages/open-core/src/core/index.mjs**
3. Test with `pnpm test:boundaries` to verify no paid-platform leakage
4. Run full suite: `pnpm test`

### Testing

```bash
# Run script-target, boundary, unit and server smoke checks
pnpm test

# Boundary check only
pnpm test:boundaries

# Unit tests (no external service or API key required)
pnpm test:unit

# Package-script target validation
pnpm test:scripts

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

### Source Distribution

Use a tagged GitHub source archive for this public snapshot. Install dependencies
and build the UI after extracting it. The old `pack:open` command referenced an
absent script and has been removed; it did not produce a verified distribution.

### Release Notes

When creating an open-core release:

1. Update version in **package.json**
2. Document changes in **CHANGELOG.md**
3. Run `pnpm build`, `pnpm test` and `pnpm lint`; retain the actual results
4. Review the source archive contents and verify the quickstart from a fresh copy
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
See **MAINTENANCE.md** for check coverage, removed commands and known limits.
