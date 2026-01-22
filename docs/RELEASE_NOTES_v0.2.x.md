# Release Notes: Shipyard Community v0.2.x

**Release Date**: January 2026  
**Focus**: Documentation hardening, contributor onboarding, troubleshooting improvements

---

## What's New

### 1. Enhanced Contributor Onboarding

**New Files**:
- **Root `CONTRIBUTING.md`**: Quick entry point directing to detailed guide in `docs/`
- **`docs/CONTRIBUTING.md`**: Comprehensive contributor guide with:
  - **Quickstart section**: Prerequisites, setup commands, smoke test verification
  - **Activation checklist**: Smoke test, polite audit, boundary check
  - Clear instructions for reporting setup issues using GitHub Issue Templates
  
**Why this matters**: New contributors can now verify their environment is correct before submitting PRs, reducing setup-related issues.

### 2. Comprehensive Troubleshooting Guide

**New File**: `docs/TROUBLESHOOTING.md`

Covers 5 common setup issues with actionable solutions:
1. **Node.js / pnpm version issues**: How to upgrade, what versions are required
2. **Windows / WSL path recommendations**: Where to clone, WSL2 vs WSL1, build tools
3. **node-pty build errors**: Optional dependency handling, skip with `DISABLE_PTY=1`
4. **Port already in use**: How to change default port 8788, find/kill conflicting processes
5. **Smoke test / polite audit verification**: How to run, what to expect, what to include when reporting issues

**Why this matters**: Reduces friction for first-time users and provides clear guidance when setup fails.

### 3. Documentation Quality Improvements

**Updated**:
- All docs now consistently reference **Shipyard Community** (legacy "Agent Dashboard" branding removed)
- GitHub Issue Templates linked throughout for structured problem reporting
- Smoke test and polite audit verification steps documented in multiple places
- Clear pointers from root `CONTRIBUTING.md` → `docs/CONTRIBUTING.md` → `docs/TROUBLESHOOTING.md`

**Fixed**:
- External link validation (all non-localhost links verified HTTP 200)
- Polite audit passes (no secrets, no placeholder emails, all required docs present)
- Internal documentation links verified (0 missing)

### 4. Activation Workflow for Contributors

Contributors now have a clear 3-step verification checklist before submitting PRs:

1. **Smoke test**: `pnpm test:smoke` (verifies basic functionality)
2. **Polite audit**: `pnpm audit:open` (verifies OSS readiness)
3. **Boundary check**: `pnpm test:boundaries` (verifies no paid-platform leakage)

Each step includes:
- Command to run
- Expected output
- What to do if it fails
- Where to report issues (GitHub Issue Templates)

---

## Breaking Changes

**None**. This release is docs-only; no API, behavior, or runtime changes.

---

## Upgrade Instructions

No action required. Pull latest `main` branch:

```bash
git pull origin main
```

If you're a contributor, review the new:
- [CONTRIBUTING.md](../CONTRIBUTING.md) (root quick reference)
- [docs/CONTRIBUTING.md](CONTRIBUTING.md) (detailed guide)
- [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md) (setup problems)

---

## Testing & Validation

All changes validated via:
- ✅ **Smoke test**: `pnpm test:smoke` passes
- ✅ **Polite audit**: `bash scripts/polite_audit.sh` passes (no secrets, no placeholder emails)
- ✅ **Link audit**: `bash scripts/docs_link_audit.sh` clean (0 internal missing, 0 external non-local 404s)
- ✅ **Branding audit**: `git grep "Agent Dashboard"` → 0 matches in active docs

---

## What's Next (v0.3.x Roadmap)

- **Enhanced compliance reporting**: Structured output formats (JSON, CSV)
- **Team collaboration workflows**: Multi-user local mode documentation
- **Pro feature comparison**: Detailed upgrade decision tree

---

## Community & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/wsery558/shipyard-community/issues/new/choose)
- **GitHub Discussions**: [Ask questions, share use cases](https://github.com/wsery558/shipyard-community/discussions)
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Contributing**: [docs/CONTRIBUTING.md](CONTRIBUTING.md)
- **Security**: [docs/SECURITY.md](SECURITY.md)

---

## Contributors

Thank you to all contributors who reported setup issues and helped improve documentation quality! 🎉

For detailed commit history, see [GitHub Releases](https://github.com/wsery558/shipyard-community/releases).
