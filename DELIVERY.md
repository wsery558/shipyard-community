# Delivery Governance Demo

This document shows what delivery governance looks like: every step is logged, verifiable, and auditable.

## Health & Smoke Summary

When you run `pnpm -s test:smoke`, the system validates:

| Endpoint | Status | Purpose |
|----------|--------|---------|
| `/health` | ✅ HTTP 200 | Service is running |
| `/api/state` | ✅ HTTP 200 | Orchestrator state retrieved |
| `/api/projects` | ✅ HTTP 200 | Project registry loaded |

**Example output:**
```
Testing on http://127.0.0.1:41189...
✅ /health: {"ok":true,"name":"agent-dashboard","version":"4.9.0-rc1"}
✅ /api/state: {"total":30,"current":"agent-dashboard 狀態同步 40%",...}
✅ /api/projects: 5 projects
✅ smoke: all checks passed
```

Every test is timestamped and logged; this is the foundation of verifiable delivery.

---

## Run Summary

A typical run snapshot includes:

```json
{
  "orchestrator": "agent-dashboard",
  "projects": [
    { "id": "agent-dashboard", "name": "Agent Dashboard", "status": "ready" },
    { "id": "demo-project", "name": "Demo Project", "status": "queued" },
    { "id": "p4", "name": "Project P4", "status": "pending" }
  ],
  "state": {
    "total": 30,
    "current": "agent-dashboard 狀態同步 40%",
    "timestamp": "2026-01-21T18:37:43Z"
  }
}
```

Every project run (in this snapshot) ships with **pre-recorded logs** under `data/runs/`:
- **Logged**: JSONL files such as `data/runs/agent-dashboard.jsonl` and `data/runs/demo-project.jsonl`
- **Meta/verify traces**: per-project folders like `data/runs/testproj/verify_rs1_*.json`
- View logs: `ls -la data/runs` and `head -n 5 data/runs/agent-dashboard.jsonl`
- Replayed/Verified: replay metadata exists, but Community uses these files as read-only examples; live replay governance is a Pro capability.

---

## Cost & Budget Summary

### Community (This Build)
- **Status**: Not available in open-core snapshot
- **Note**: Budget tracking is a **Pro feature**

**Pro provides:**
- Real-time cost tracking per project
- Budget alerts and enforcement
- Historical cost analysis and trends

```
⚠️ Community: Cost tracking disabled (501)
   → Budget features available in Shipyard Pro
```

---

## Audit & Activity Log

### Community (This Build)
- **Status**: Basic logging only (no retention or RBAC)

**Pro provides:**
- **Audit trail**: Every action logged with actor, timestamp, resource, change
- **Retention**: Configurable retention policies (90/180/365 days)
- **RBAC**: Role-based access control (admin, reviewer, executor, observer)
- **SLA**: Compliance reporting and SLA tracking
- **Export**: Audit logs exportable in JSON/CSV for compliance audits

```
Community activity:
  - Sample run logs live in `data/runs/*.jsonl` (e.g., `data/runs/agent-dashboard.jsonl`, `data/runs/demo-project.jsonl`)
  - Replay/meta artifacts live in `data/runs/<project>/verify_*_meta.json`
  - State changes recorded in memory during smoke/demo (no new files written)
  - No user attribution or retention policy

Pro governance:
  ✅ Full audit trail with actor identity
  ✅ Retention policies & archival
  ✅ Role-based execution gates
  ✅ SLA/compliance reporting
  ✅ Export for compliance audits
```

---

## Why Governance Matters

Delivery governance answers these questions:

1. **Who** executed this step? (Actor attribution)
2. **What** changed? (Resource delta)
3. **When** did it happen? (Timestamp)
4. **Why** was it allowed? (Policy decision)
5. **Can** we replay it? (Reproducibility)

### Community delivers:
- ✅ Local orchestrator (step 1–4 partially)
- ✅ Replayable runs (step 5)
- ❌ No multi-user governance (steps 1, 4 limited)
- ❌ No compliance reporting (all steps)

### Pro delivers:
- ✅ Full audit trail (all steps)
- ✅ Policy enforcement (step 4)
- ✅ Compliance export (all steps)
- ✅ Team RBAC (step 1, 4)

---

## Next Steps

- Run the demo: `bash scripts/demo_30min.sh`
- Inspect bundled run logs: `ls -la data/runs` and `head -n 5 data/runs/agent-dashboard.jsonl`
- Explore replay/meta examples: `find data/runs -type f -name "*_meta.json" | head`
- Try a custom project: add to `./data/projects.json` and re-run
- Upgrade to Pro: governance layer + team management + compliance

Learn more: [Community vs Pro](README.md#community-vs-pro)
