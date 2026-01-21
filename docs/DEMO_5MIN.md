# 5-Minute Demo: Why Shipyard Pro

**Goal**: See three concrete pain points that Community solves, and why Pro addresses them at scale.

Pain → Proof → Upgrade (5-minute path):
- **Pain**: Accountability, audit trail, repeatability.
- **Proof (Community)**: Run locally and show activity on-screen (logs, artifacts, budget view).
- **Upgrade (Pro)**: Exportable **Activity Export**, **Evidence Bundle**, and **Spec Vault** so you can prove what ran, what changed, what it cost, and how it passed compliance.

**Community helps you run. Pro helps you prove.**

**Time**: 5 minutes  
**Setup**: `pnpm start` (server running on port 8788)

---

## 0:00–0:30 | Start Server, Load UI

### What to do
```bash
pnpm start
```
Then open **http://127.0.0.1:8788** in your browser.

### What you see
- A **React dashboard** with a project list on the left
- A **terminal pane** on the right (real-time output)
- **Menu options**: Run, Logs, Audit, Reports (top navigation)

**Pain point 1 emerging**: "I need to know *exactly* what happened in my project, step by step."

---

## 0:30–2:00 | Proof #1: Traceable Run Timeline

### What to do
1. Click **"Logs"** in the top menu
2. Select a recent project from the list (e.g., `agent-dashboard`)
3. Click **"View Audit Log"** or **"Download CSV"**

### What you see
A **timestamped audit log** showing:
- **TASK_STARTED** → 2026-01-22T06:12:34Z
- **COMMAND_PROPOSED** → 2026-01-22T06:12:45Z
- **POLICY_EVALUATED** → 2026-01-22T06:12:46Z
- **COMMAND_APPROVED** → 2026-01-22T06:12:50Z (or DENIED if dangerous)
- **TASK_DONE** → 2026-01-22T06:13:01Z

Each entry shows:
- **Timestamp** (ISO 8601, searchable)
- **What** (task, command, policy decision)
- **Who** (approver name, or "SYSTEM" for auto-gates)
- **Why** (reason for policy denial, cost flag, timeout, etc.)

**Proof #1**: Every step is **logged, timestamped, and queryable**. If a task failed, you can replay it with the exact same inputs.

**Why Pro matters**: 
- *Community*: One local audit log per project (JSON file under `./data/`).
- *Pro*: **Cross-team audit trail** with **Activity Export** and **Evidence Bundle** for compliance-ready sharing; query by user/date/outcome.

---

## 2:00–3:30 | Proof #2: Fail-Fast with Artifacts

### What to do
1. Click **"Reports"** in the top menu
2. Click on any project run (should see summary cards)
3. Expand a **failed or blocked task**

### What you see
For each task:
- **Status**: "done", "failed", "blocked", "timeout"
- **Output** (last 500 chars):
  - Error message if it failed
  - "Budget exceeded" if cost overrun
  - "Policy denied" if dangerous command
- **Artifacts** (if available):
  - Command run: `git diff --stat`
  - Patch generated: `- src/core/utils.mjs: fixed memory leak`
  - Summary: "Memory optimization reduced allocations by 40%"

**Proof #2**: When a task fails, you see:
1. **Why** it failed (policy, budget, timeout, execution error)
2. **What** was attempted (command, patch)
3. **Where** to look next (terminal output, logs, artifact download)

This keeps bad changes from shipping to production.

**Why Pro matters**:
- *Community*: Artifacts stored locally; you manage backup/archival.
- *Pro*: **Artifacts indexed and searchable by project/date**, shipped in an **Evidence Bundle**, and stored in **Spec Vault** with retention and access controls.

---

## 3:30–4:30 | Proof #3: Visible Cost & Budget Control

### What to do
1. Click **"State"** or **"Dashboard"** in the top menu
2. Look for the **Cost Summary** card:
   ```
   Total Spend: $23.45
   Budget Remaining: $76.55 / $100.00
   Projected: 180 tasks @ $0.13/task = $23.40
   ```
3. Click on a project to see its **cost breakdown**:
   - Engineer model (PM): 5 tasks × $0.03 = $0.15
   - Plan creation (Claude): 2 tasks × $0.05 = $0.10
   - Verification (Sonnet): 10 tasks × $0.02 = $0.20

### What you see
Every cost is:
- **Attributed** (which model, which task)
- **Timestamped** (when it occurred)
- **Counted toward budget** (system pauses if limit exceeded)

**Proof #3**: You have **complete visibility** into:
1. Total spend vs. budget
2. Which models cost what
3. When the budget ran out (tasks paused automatically)

This prevents surprise bills and ensures predictable delivery cost.

**Why Pro matters**:
- *Community*: Budget enforced per project, local-only; you manage cost tracking in spreadsheets.
- *Pro*: **Team-wide budget pools**, cost attribution by user, multi-project rollups, variance alerts, invoice integration, and **Activity Export** for finance/compliance.

---

## 4:30–5:00 | Why Upgrade to Pro?

**Community delivers**: Traceable runs, fail-fast gates, visible cost control. **Community helps you run.**

**Pro adds governance at scale**: Exportable **Activity Export**, **Evidence Bundle**, and **Spec Vault** so you can prove what ran, what changed, what it cost, and how it passed compliance. **Pro helps you prove.**

| Problem | Community | Pro |
|---------|-----------|-----|
| **One person runs a task; crashes. No one else knows.** | Audit log is local; other team members can't see it. | Audit trail is shared; every team member sees policy decisions in real-time. |
| **A new team member can run any command.** | No user tracking; anyone with server access can approve. | Role-based approval; only authorized users can override policy gates. |
| **Cost tracking is manual.** | You export JSON and import to Excel. | Automatic dashboards, cost attribution by user/project/date, variance alerts. |
| **Need to prove compliance to customers.** | You manually compile audit logs + screenshots. | Exportable compliance report: policy decisions, approvals, cost breakdown—single click. |
| **Running across 50 projects in your org.** | No cross-project budget pooling; each project has its own limit. | Team-wide budget pool, cost optimization recommendations, usage forecasts. |

---

## Summary

✅ **Community (this build)**: Orchestration, policy gates, local cost tracking, full audit trail.  
✨ **Pro**: Team governance, shared audit, role-based approval, commercial cost analytics, compliance reporting.

**Next steps**:
- [See detailed governance walkthrough →](OPEN_DELIVERY.md#governance)
- [Read evidence pack with screenshots →](EVIDENCE_PACK.md)
- [Learn about policy gates and budget →](OPEN_DELIVERY.md#safety-and-policy)
- [Contact sales for Pro trial →](#contact)

---

*Last updated: 2026-01-22*
