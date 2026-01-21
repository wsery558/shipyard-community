# Agent Dashboard Open Core

[![CI](https://github.com/github/agent-dashboard-open/actions/workflows/ci.yml/badge.svg)](https://github.com/github/agent-dashboard-open/actions/workflows/ci.yml)

Local-first open-core snapshot of Agent Dashboard. This build runs without platform services or API keys; all paid/platform endpoints return HTTP 501 by design so you can lean on the open-source workflow without accidentally invoking gated services.

## What it is
Agent Dashboard Open Core delivers the orchestrator, data stores, and React UI you need to explore the project + run lifecycle locally. Everything runs from the repo, static `ui-dist`, and file-backed `./data` stores; the snapshot omits platform/paid APIs (they intentionally return 501) so the experience stays self-contained.

## Shipyard: Delivery Governance, Not Chat

Shipyard is built for **reliable delivery**—not conversation. You get a replayable, verifiable, shippable workflow:
- **Replayable**: Every project run is logged and timestamped; any step can be re-executed with the same inputs.
- **Verifiable**: Compliance, safety gates, budget guards, and compliance reporting ensure nothing ships unvetted.
- **Shippable**: The orchestrator handles the full project lifecycle: plan, execute, report, and archive.

Unlike code assistants or chat-based tools, Shipyard **governs delivery** from request through archive, so your team can trust what ships.

## Community vs Pro

| Feature | Community (This Build) | Shipyard Pro |
|---------|------------------------|--------------|
| **Local Orchestrator** | ✅ Full | ✅ Full |
| **Project Management** | ✅ Yes | ✅ Yes |
| **Run Lifecycle** | ✅ Yes | ✅ Yes |
| **Compliance Reports** | ✅ Yes | ✅ Enhanced |
| **Platform Auth** | ❌ 501 (intentional) | ✅ Yes |
| **Team Entitlements** | ❌ 501 (intentional) | ✅ Yes |
| **Usage Analytics** | ❌ 501 (intentional) | ✅ Full |
| **Admin Governance** | ❌ 501 (intentional) | ✅ Full |

The `501` responses are **by design**: Community is the open-core entry point. Pro adds platform governance, team management, and analytics.

## Quickstart

### Requirements
- Node.js 20 or newer (includes the built-in `fetch` used by smoke runs)
- pnpm 9 or newer

### Install
```bash
pnpm install
```

### Build
```bash
pnpm build
```
Compiles the React UI into `ui-dist` so the combined server + UI bundle is ready to serve.

### Start (default port)
```bash
pnpm start
```
Serves the API and static UI on port **8788** unless you override `PORT=`.

### API demos (with server running on port 8788)
```bash
# 1) Health check
curl -fsS http://127.0.0.1:8788/health

# 2) Inspect the current orchestrator state
curl -fsS http://127.0.0.1:8788/api/state

# 3) List the configured projects
curl -fsS http://127.0.0.1:8788/api/projects
```

Optional: query `/api/project-status` for a specific project once you know the ID. In this open-core snapshot it now returns a lightweight stub (`{ projectId, status: "unknown", note: "Platform project status is not available in this open-core snapshot." }`) so demos never surface a 500 error.

## Troubleshooting
- **Missing `ui-dist`**: Run `pnpm build` to regenerate the bundled UI from [ui](ui/).
- **Port 8788 already in use**: Run with a different port:
  ```bash
  PORT=3100 pnpm start
  ```
- **OpenAI key**: Not required. All OpenAI-powered endpoints return HTTP 501 unless you set `OPENAI_API_KEY`; this keeps the open-core snapshot self-contained.
- **Smoke test fails**: The smoke script runs on an ephemeral port by default. Override with `SMOKE_PORT=<port>` if needed; the script sets `WS_SMOKE=1` and pings `/health`, `/api/state`, and `/api/projects`.

## Open-core included vs paid/platform (501 by design)
### Included
- Local orchestrator (projects, runs, plans, budget, reports, safety gating)
- Static UI served from `ui-dist`
- Offline default data backed by `./data`

### Paid/platform endpoints that return HTTP 501
- `/api/compliance/passive`
- `/api/platform/auth/me`
- `/api/platform/entitlements`
- `/api/platform/admin/entitlements/grant`
- `/api/platform/admin/entitlements/revoke`
- `/api/platform/events`
- `/api/platform/admin/events`
- `/api/platform/admin/metrics`
- `/api/platform/admin/compliance`
These stubs signal intentionally omitted paid/platform features.

## Scripts
- `pnpm build` – produces `ui-dist` for the bundled server/UI experience.
- `pnpm start` / `pnpm dev` – serves API + UI on `PORT` (default 8788).
- `pnpm test:smoke` – runs the smoke matrix (`WS_SMOKE=1`) and hits `/api/state`, `/api/projects`.
- `pnpm lint` – permissive lint pass over `.js`/`.mjs`/`.jsx`; emits warnings but exits 0.
- `pnpm typecheck` – stub: prints “No TypeScript typecheck (JS project)”.
- `pnpm test:unit` – stub: prints “No unit tests in open-core snapshot”.
## Delivery Governance Demo

See [DELIVERY.md](DELIVERY.md) for a walkthrough of how governance works: smoke checks, run summaries, cost tracking (Pro feature), and audit logs.

## Contributing & policies
- Contribution guide: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- Security policy: [docs/SECURITY.md](docs/SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- License: MIT ([LICENSE](LICENSE))

## Data locations
Local JSON stores live under `./data` (projects, plans, state, cost, usage). Back up this directory before upgrades.
