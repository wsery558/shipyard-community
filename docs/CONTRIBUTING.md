# Contributing to Shipyard Community

Thank you for contributing to **Shipyard Community**! This guide covers code organization, testing, and release processes.

---

## Quickstart for Contributors

### Prerequisites
- **Node.js 20+** and **pnpm 9+**
- Verify: `node --version` (should show v20.x.x+) and `pnpm --version` (should show 9.x.x+)

### Setup
```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/shipyard-community.git
cd shipyard-community

# 2. Install dependencies
pnpm install

# 3. Build the UI
pnpm build

# 4. Run smoke test to verify setup
pnpm test:smoke
```

**Expected smoke test output**:
```
✅ Health check: OK
✅ State endpoint: OK
✅ Projects endpoint: OK
Smoke test PASSED
```

### Activation: Verify Your Contribution Environment

Before submitting a PR, run these verification checks:

**1. Smoke test** (basic functionality):
```bash
pnpm test:smoke
```

**2. Polite audit** (OSS readiness—no secrets, no placeholder emails, all required docs):
```bash
pnpm audit:open
# OR directly:
bash scripts/polite_audit.sh
```

Expected output:
```
════════════════════════════════════════════════
  ✅ POLITE AUDIT PASSED
  Repository is ready for OSS release
════════════════════════════════════════════════
```

**3. Boundary check** (ensure no paid-platform code leaks into open-core):
```bash
pnpm test:boundaries
```

**If any check fails**, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or [open a GitHub issue](https://github.com/wsery558/shipyard-community/issues/new?template=quickstart_problem.yml).

---

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
2. Export from **packages/open-core/src/index.mjs**
3. Test with `pnpm test:boundaries` to verify no paid-platform leakage
4. Run full suite: `pnpm test`

---

## Testing

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

---

## Git Workflow

1. **Create feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. **Make changes** to open-core modules
3. **Run verification**:
   ```bash
   pnpm test
   pnpm audit:open
   ```
4. **Commit** with conventional commit messages (see below)
5. **Push** and **open PR** with clear description
6. After merge, boundary check runs on CI

---

## Open Release Packaging

To create a distribution tarball:

```bash
pnpm pack:open
```

This:
1. Audits for paid-platform code
2. Verifies all paid routes stubbed (501)
3. Creates tarball with only open-core
4. Includes OPEN_DELIVERY.md, LICENSE, SECURITY.md

Output: `shipyard-community-open-v0.x.tar.gz`

---

## Release Notes

When creating an open-core release:

1. Update version in **package.json**
2. Document changes in **CHANGELOG.md**
3. Run `pnpm pack:open`
4. Verify tarball contents
5. Commit and tag:
   ```bash
   git tag open/v0.x
   git push origin open/v0.x
   ```

---

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

---

## Commit Messages

Use conventional commits:
```
feat(core): add new module X
fix(server): fix crash on Y
docs(delivery): update getting started
chore(boundaries): improve check script
```

---

## Reporting Issues

**Encountered a problem during setup?**
Use the [Quickstart problem template](https://github.com/wsery558/shipyard-community/issues/new?template=quickstart_problem.yml) and include:
- OS and version
- `node --version` and `pnpm --version`
- Output of `pnpm test:smoke`
- Full error logs

For troubleshooting guidance, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## Questions?

- **Detailed distribution guide**: [OPEN_DELIVERY.md](OPEN_DELIVERY.md)
- **Security concerns**: [SECURITY.md](SECURITY.md)
- **Code of Conduct**: [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)
- **Community discussions**: [GitHub Discussions](https://github.com/wsery558/shipyard-community/discussions)
