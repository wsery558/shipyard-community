# OPEN DELIVERY: Shipyard Community v0.1 Open-Core Distribution Guide

## Overview

**Shipyard Community Open Core** is the free, open-source foundation of Shipyard Community. It provides:

- ✅ Workflow execution and task management
- ✅ Artifact generation and tracking
- ✅ Cost monitoring and budgeting
- ✅ Health monitoring and alerts
- ✅ Plan management (default/verify/danger)
- ✅ Compliance checking (open-source requirements)
- ✅ Local-first design (fully offline)

**NOT Included:**
- ❌ Platform authentication (OAuth, SAML)
- ❌ User entitlements (license checking)
- ❌ Analytics events (telemetry)
- ❌ Cloud integration (API calls)
- ❌ Compliance audit trails (commercial)

---

## 1. Getting Started

### Installation

```bash
# Extract distribution
tar -xzf shipyard-community-open-v0.1.tar.gz
cd shipyard-community-open-v0.1

# Install dependencies
pnpm install

# Start server (no build needed)
node server.mjs
```

Server starts on **http://localhost:8788**

**Environment Variables:**
- `PORT` — Server port (default: 8788)
- `DISABLE_PTY=1` — Disable terminal features (useful for CI/headless environments; node-pty will not be loaded)
- `OPENAI_API_KEY` — Optional; enables AI-powered features (not required for open-core)

**Note:** Terminal features require the `node-pty` native module. If you encounter issues loading node-pty (e.g., in Docker, CI, or headless environments), set `DISABLE_PTY=1` to run without terminal support. All core endpoints (/health, /api/state, /api/projects) remain fully functional.

### First Run

1. Open http://localhost:8788 in browser
2. Click "Create Project" or "+" button
3. Enter project name and parameters
4. View tasks, artifacts, health metrics
5. Switch between plans (default/verify/danger)

**No login required.** All data is stored locally in `data/` directory.

---

## 2. Architecture

### Directory Structure

```
shipyard-community-open-v0.1/
├── server.mjs              # Express server (runs on :8788)
├── package.json
├── pnpm-lock.yaml
│
├── ui/                     # React UI (Vite)
│  ├── index.html
│  ├── main.jsx            # Entry point
│  └── vite.config.js
│
├── apps/dashboard/src/
│  └── components/
│      └── ProjectUI.jsx   # Main UI component
│
├── packages/open-core/     # 19 Open-source modules
│  └── src/
│      ├── core.mjs        # Core entry point
│      ├── projectCore.mjs  # Project management
│      ├── artifactManager.mjs
│      ├── budgetManager.mjs
│      ├── healthCheck.mjs
│      ├── planManager.mjs
│      ├── complianceRunner.mjs
│      └── ... (14 more modules)
│
├── data/                   # Local state (JSON files)
│  ├── state.json
│  ├── cost.json
│  ├── projects.json
│  ├── plans/
│  │  ├── default.json
│  │  ├── verify.json
│  │  └── danger.json
│  └── usage/
│      ├── default.json
│      ├── ktv.json
│      └── shipyard-community.json
│
├── scripts/
│  └── audit_open_release.mjs  # Verify integrity
│
├── docs/
│  ├── OPEN_DELIVERY.md    # This file
│  ├── LICENSE             # MIT license
│  ├── SECURITY.md         # Security properties
│  └── CONTRIBUTING.md     # Development guide
│
└── test/                   # Unit tests (not included in tarball)
```

### API Endpoints

#### Workflow Management
- **GET /api/projects** - List all projects
- **POST /api/projects** - Create project
- **GET /api/projects/:id** - Get project details
- **POST /api/projects/:id/tasks** - Queue task
- **GET /api/projects/:id/tasks** - List tasks
- **GET /api/projects/:id/artifacts** - List artifacts

#### Health & Monitoring
- **GET /api/health** - Overall system health
- **GET /api/projects/:id/health** - Project health
- **POST /api/projects/:id/health/check** - Run health check

#### Cost & Budgeting
- **GET /api/cost** - Total cost tracking
- **GET /api/cost/projects** - Cost by project
- **POST /api/cost/budget** - Set budget

#### Compliance
- **GET /api/compliance/status** - Compliance status
- **GET /api/compliance/requirements** - Open-source requirements
- **POST /api/compliance/check** - Run compliance check

#### Plans
- **GET /api/plans** - List available plans
- **POST /api/projects/:id/plan** - Set project plan
- **GET /api/projects/:id/plan** - Get current plan

#### Stub Endpoints (Return 501)
All platform-specific endpoints return:
```json
{
  "error": "Not implemented in Open Core",
  "feature": "...",
  "requires": "paid-platform module"
}
```

These include:
- `/api/platform/auth/me` - User info
- `/api/platform/entitlements` - License checking
- `/api/platform/events` - Analytics
- `/api/platform/admin/metrics` - Usage metrics
- `/api/platform/admin/compliance` - Compliance audit
- And 4 more for entitlement management

---

## 3. Configuration

### Environment Variables

```bash
# Port (default 8788)
PORT=8788

# Data directory (default ./data)
DATA_DIR=./data

# Log level (default info)
LOG_LEVEL=debug

# No auth mode (default true)
NO_AUTH=true
```

### Default Plans

Located in `data/plans/`:

**default.json** - General workflows
```json
{
  "name": "default",
  "timeout": 3600,
  "maxTasks": 100,
  "costLimit": 50.00
}
```

**verify.json** - Quality verification
```json
{
  "name": "verify",
  "timeout": 1800,
  "maxTasks": 10,
  "costLimit": 20.00
}
```

**danger.json** - Unrestricted execution
```json
{
  "name": "danger",
  "timeout": 7200,
  "maxTasks": 500,
  "costLimit": null
}
```

Modify these files to change plan behavior. Server reloads on next request.

### Compliance Rules

Located in `data/plans/default.json` > `complianceRules`:

```json
{
  "requireLicense": false,
  "requireAuditLog": false,
  "checkEntitlements": false,
  "enforceBudget": true,
  "enforceTimeout": true
}
```

All compliance checks are **optional** in open-core mode.

---

## 4. Usage Examples

### Creating a Project

```bash
curl -X POST http://localhost:8788/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-workflow",
    "description": "Test project",
    "plan": "default"
  }'
```

Response:
```json
{
  "id": "proj_abc123",
  "name": "my-workflow",
  "status": "idle",
  "health": "good",
  "plan": "default"
}
```

### Queuing a Task

```bash
curl -X POST http://localhost:8788/api/projects/proj_abc123/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generate",
    "target": "artifact",
    "params": {
      "model": "gpt-4",
      "prompt": "Generate a Python function"
    }
  }'
```

### Checking Health

```bash
curl http://localhost:8788/api/projects/proj_abc123/health
```

Response:
```json
{
  "projectId": "proj_abc123",
  "status": "good",
  "checks": {
    "tasks": { "passed": 45, "failed": 0 },
    "artifacts": { "total": 23, "valid": 23 },
    "budget": { "used": 12.50, "limit": 50.00 },
    "compliance": { "open": "good", "paid": "n/a" }
  },
  "lastCheck": "2025-01-15T10:30:00Z"
}
```

### UI Navigation

1. **Projects Panel** - Left side, list all projects
2. **Project Detail** - Right side, tabs for:
   - **Tasks** - Pending/completed tasks
   - **Health** - System health metrics
   - **Replay** - Artifact/task replay
   - **Reports** - Execution reports
   - **Queue** - Task queue management
   - **Policy** - Budget/timeout policies
   - **Compliance** - Compliance status
   - **Platform** - (DISABLED in open-core)

---

## 5. Data & Persistence

### Local Storage

All data is stored in `data/` as JSON files:

```
data/
├── state.json              # Global state
├── cost.json               # Cost tracking
├── projects.json           # Project registry
├── plans/
│  ├── default.json        # Default plan
│  ├── verify.json         # Verify plan
│  └── danger.json         # Danger plan
└── usage/
   ├── default.json        # Usage tracking
   ├── ktv.json           # Cost/token tracking
   └── shipyard-community.json
```

### Backup Strategy

**Before significant changes, backup your data:**

```bash
cp -r data data.backup.$(date +%Y%m%d_%H%M%S)
```

### Data Migration

To migrate from one installation to another:

```bash
# On old system
cp -r data/ export/

# On new system
cp -r export/data .
```

---

## 6. Development & Customization

### Running Tests

```bash
# All tests (includes boundary check)
pnpm test

# Unit tests only
pnpm test:unit

# Smoke tests
pnpm test:smoke

# Audit open-core integrity
pnpm audit:open
```

### Building UI

```bash
# Rebuild UI assets
pnpm build:ui

# Development mode with watch
pnpm dev
```

### Adding a Custom Module

1. Create `packages/open-core/src/myModule.mjs`
2. Export from `packages/open-core/src/core.mjs`
3. Import in `server.mjs`:
   ```javascript
   import { myFunction } from './packages/open-core/src/myModule.mjs';
   ```
4. Test with `pnpm test:boundaries`

### Modifying Plans

Edit `data/plans/default.json`:

```json
{
  "name": "default",
  "timeout": 3600,
  "maxTasks": 200,
  "costLimit": 100.00,
  "complianceRules": {
    "enforceBudget": true,
    "enforceTimeout": true
  }
}
```

Changes take effect on next request (no restart needed).

---

## 7. Troubleshooting

### Server won't start

```bash
# Check port 8788 is available
lsof -i :8788

# Use different port
PORT=4000 node server.mjs
```

### Data directory permissions

```bash
# Ensure write permissions
chmod -R 755 data/
```

### UI not loading

```bash
# Check UI was built
ls -la ui-dist/
pnpm build:ui

# Restart server
node server.mjs
```

### Memory issues with large projects

```bash
# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" node server.mjs
```

### Corrupted JSON files

1. Stop server
2. Restore from backup or delete corrupted file
3. Restart server (server will recreate default file)

---

## 8. Compliance & Licensing

### Open-Source License

Licensed under **MIT License** (see [LICENSE](LICENSE)).

You are free to:
- ✅ Use commercially
- ✅ Modify the code
- ✅ Distribute
- ✅ Sublicense

With conditions:
- 📋 Include original license
- 📋 No liability

### Open-Source Requirements

The compliance checker verifies:
- ✅ No commercial licensing code
- ✅ No auth/entitlements code
- ✅ All required core modules present
- ✅ No hardcoded secrets

Run: `pnpm audit:open`

### Commercial Version

The full **Shipyard Community** (with paid features):
- Cloud integration (Anthropic API)
- User management & authentication
- Entitlement checking & licensing
- Analytics & telemetry
- Compliance audit trails
- Professional support

Contact: tsaielectro0628@gmail.com

---

## 9. Maintenance & Updates

### Checking for Updates

This is the **v0.1 open-core release**. Check the repository for:
- Bug fixes
- Security patches
- New open-source modules

### Applying Updates

```bash
# Download new tarball
tar -xzf shipyard-community-open-v0.2.tar.gz -C shipyard-community-new

# Merge with your customizations
# Then test thoroughly
pnpm test

# Backup old data
cp -r data data.backup

# Start with new version
node server.mjs
```

### Security Patches

Critical patches will be released as `open/vX.Y.Z` tags on GitHub.

Subscribe to security announcements via:
- GitHub Releases
- Security mailing list (coming soon)

---

## 10. Advanced Topics

### Custom Compliance Checks

Edit `packages/open-core/src/complianceRunner.mjs`:

```javascript
export function registerCustomCheck(name, checkFn) {
  // checkFn returns { passed: boolean, details: string }
}
```

### Scaling to Multiple Projects

The open-core version is designed for single-instance operation. For multiple concurrent projects:

1. Use separate `DATA_DIR` per instance
2. Or migrate to cloud-backed storage (requires code changes)

### Integration with CI/CD

Use the REST API to integrate workflows:

```bash
#!/bin/bash
curl -X POST http://localhost:8788/api/projects/my-proj/tasks \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "type": "generate",
  "target": "artifact",
  "params": { "model": "gpt-4" }
}
EOF
```

---

## 11. Support & Community

### Getting Help

- 📖 See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development
- 🔒 Security issues: tsaielectro0628@gmail.com
- 🐛 Bug reports: GitHub Issues (coming soon)
- 💬 Discussions: GitHub Discussions (coming soon)

### Contributing

The open-core is **community-driven**. Contributions welcome!

1. Fork the repository
2. Create feature branch
3. Run `pnpm test` to verify
4. Submit PR with description

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details.

### Commercial Support

For production deployments, licensing, or custom integrations:
- Contact: tsaielectro0628@gmail.com
- Website: https://shipyard.tsaielectro.com/en/

---

## 12. Quick Reference

### Common Commands

```bash
# Start server
node server.mjs

# Run all tests
pnpm test

# Check boundaries
pnpm test:boundaries

# Audit open-core
pnpm audit:open

# Rebuild UI
pnpm build:ui

# Create new open-core tarball
pnpm pack:open
```

### API Quick Reference

```bash
# Projects
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
POST   /api/projects/:id/tasks

# Health
GET    /api/health
GET    /api/projects/:id/health

# Cost
GET    /api/cost
GET    /api/cost/projects

# Compliance
GET    /api/compliance/status
POST   /api/compliance/check

# Plans
GET    /api/plans
POST   /api/projects/:id/plan
```

---

## Appendix: File Listing

**Distribution Contents** (shipyard-community-open-v0.1.tar.gz):

```
✅ server.mjs (5 KB)
✅ package.json (2 KB)
✅ pnpm-lock.yaml (500 KB)
✅ packages/open-core/ (50 KB, 19 modules)
✅ apps/dashboard/src/ (80 KB, React UI)
✅ ui/ (20 KB, HTML + Vite config)
✅ data/ (10 KB, sample data)
✅ scripts/audit_open_release.mjs (8 KB)
✅ docs/OPEN_DELIVERY.md (this file)
✅ docs/LICENSE (1 KB, MIT)
✅ docs/SECURITY.md (3 KB)
✅ docs/CONTRIBUTING.md (4 KB)

Total: ~680 KB compressed
```

**NOT Included** (paid-platform features):
```
❌ /api/platform/auth/me
❌ /api/platform/entitlements
❌ /api/platform/events
❌ /api/platform/admin/* (metrics, compliance, compliance audit)
❌ Platform Portfolio UI tab
❌ User management
❌ License validation
❌ Cloud integration code
```

---

**Release Date:** 2025-01-15  
**Version:** 0.1  
**Status:** Production Ready  
**License:** MIT

For the latest version and updates, visit: https://github.com/example/shipyard-community
