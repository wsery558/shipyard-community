# Shipyard Community Open Core

[![CI](https://github.com/wsery558/shipyard-community/actions/workflows/ci.yml/badge.svg)](https://github.com/wsery558/shipyard-community/actions/workflows/ci.yml)

**Shipyard Community: Local-first delivery governance without the team features.**

Local-first open-core snapshot of Shipyard Community. This build runs without platform services or API keys; all paid/platform endpoints return HTTP 501 by design so you can lean on the open-source workflow without accidentally invoking gated services.

---

## The Problem You're Solving

Pain → Proof → Upgrade (5-minute path):
- **Pain (accountability, audit trail, repeatability)**: You need traceable runs, verifiable failures, and visible cost control.
- **Proof (Community)**: Run locally, show on-screen logs and artifacts to demonstrate what happened.
- **Upgrade (Pro)**: Exportable **Activity Export**, **Evidence Bundle**, and **Spec Vault** so you can prove what ran, what changed, what it cost, and how it passed compliance.

You need **three things** to ship reliably:
1. **Traceable runs**: Every task start, policy decision, approval, and completion is timestamped and logged. When something fails, you know exactly what happened.
2. **Verifiable failures**: Failed tasks show the command, patch, and output. Bad changes never reach production because policy gates require approval for dangerous operations.
3. **Visible cost control**: Every API call is attributed to a model and project. Budget limits are enforced; overage is prevented. Your team knows what delivery costs.

**Community solves all three locally.** Pro solves them for your team at scale.

**Community helps you run. Pro helps you prove.**

👉 **[See all three in action → 5-Minute Demo](docs/DEMO_5MIN.md)** ⏱️

---

## Shipyard: Delivery Governance, Not Chat

Shipyard is built for **reliable delivery**—not conversation. You get a replayable, verifiable, shippable workflow:
- **Replayable**: Every project run is logged and timestamped; any step can be re-executed with the same inputs. See [Audit Trail →](docs/EVIDENCE_PACK.md#proof-point-1-complete-audit-trail-traceable-runs)
- **Verifiable**: Compliance, safety gates, budget guards, and compliance reporting ensure nothing ships unvetted. See [Policy Gates →](docs/EVIDENCE_PACK.md#proof-point-2-policy-gates-fail-fast-verification)
- **Shippable**: The orchestrator handles the full project lifecycle: plan, execute, report, and archive. See [Cost Control →](docs/EVIDENCE_PACK.md#proof-point-4-cost-tracking--budget-control-visible-cost)

Unlike code assistants or chat-based tools, Shipyard **governs delivery** from request through archive, so your team can trust what ships.

## Community vs Pro: Know What You're Getting

**Community delivers**: Traceable runs, fail-fast gates, visible cost. Single-project, local-only.

**Pro adds team governance**: Shared audit trail, role-based approval, team budgets, compliance reports, cross-project oversight.

| Feature | Community (This Build) | Pro | Why |
|---------|---|---|---|
| **Audit Trail** | ✅ Local logs (JSON) | ✅ + Team-wide search, retention proof | Compliance: prove policy decisions |
| **Policy Gates** | ✅ Dangerous commands require approval | ✅ + Role-based (Seniors only), escalation | Governance: enforce org standards |
| **Budget Control** | ✅ Per-project budget limit | ✅ + Team pools, cost attribution, alerts | Cost control: spend predictably |
| **Artifacts** | ✅ Patches, output, error logs | ✅ + Indexed, searchable, auto-retention | Debugging: find what failed quickly |
| **Reports** | ✅ CSV/PDF export (manual) | ✅ + One-click compliance PDF, legal grade | Audits: SOC2-ready format |
| **Evidence Output (Governance Proof)** | 📺 On-screen logs; manual screenshots (no export package) | 📦 **Activity Export** + **Evidence Bundle** + **Spec Vault** | Prove what ran, changed, cost, and passed compliance in a shareable package |
| **Real-Time** | ✅ Live dashboard (localhost) | ✅ + Team shared, role-based visibility, alerts | Collaboration: everyone sees status |
| **Platform Auth** | ❌ 501 (not needed locally) | ✅ SSO, SAML, OAuth | Enterprise: scale beyond founders |
| **Team Entitlements** | ❌ 501 (all-or-nothing) | ✅ Role-based access (PM, Engineer, Admin) | Multi-team: who can do what |

**The `501` responses are intentional**: Community is the open-core entry point. Pro adds platform governance, team management, and enterprise scale.

### When to Upgrade to Pro

**Stay on Community if:**
- You're building solo or with one other person
- All users have server SSH/console access
- You're managing cost in spreadsheets
- Audit logs are for your own reference

**Upgrade to Pro if:**
- Your team has >2 people and doesn't all have server access
- You need to prove compliance to customers (SOC2, ISO)
- Cost attribution by user/date is required
- You want policy gates enforced by role, not honor system

👉 **[Try Pro for 14 days (free) →](#contact-sales)** or **[See detailed comparison](docs/DEMO_5MIN.md)**

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

-## Troubleshooting
- **Missing `ui-dist`**: Run `pnpm build` to regenerate the bundled UI from [ui](ui/).
- **Port 8788 already in use**: Run with a different port:
  ```bash
  PORT=3100 pnpm start
  ```
- **OpenAI key**: Not required. All OpenAI-powered endpoints return HTTP 501 unless you set `OPENAI_API_KEY`; this keeps the open-core snapshot self-contained.
- **Smoke test fails**: The smoke script runs on an ephemeral port by default. Override with `SMOKE_PORT=<port>` if needed; the script sets `WS_SMOKE=1` and pings `/health`, `/api/state`, and `/api/projects`.
- For more troubleshooting guidance, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

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
