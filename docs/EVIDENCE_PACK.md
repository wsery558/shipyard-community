# Evidence Pack: Proof Points for Shipyard Community vs Pro

This guide maps six concrete proof points to their UI locations, API endpoints, and reproduction steps. Use these to build **demo videos** or **screenshots** that show why your org needs Pro.

Pain → Proof → Upgrade (5-minute path):
- **Pain**: Accountability, audit trail, repeatability.
- **Proof (Community)**: Run locally and show activity on-screen (logs, artifacts, cost, policy gates).
- **Upgrade (Pro)**: Exportable **Activity Export**, **Evidence Bundle**, and **Spec Vault** so you can prove what ran, what changed, what it cost, and how it passed compliance.

**Community helps you run. Pro helps you prove.**

---

## Proof Point 1: Complete Audit Trail (Traceable Runs)

**What it proves**: Every action—task start, policy decision, approval/denial, command execution, completion—is logged with timestamp and actor.

**Pain it solves**: "We ran a task 3 days ago. What exactly did it do? Who approved it? What was the output?"

### Location
- **UI Path**: Menu → **Logs** → Select project → **View Audit Log** (or **Download CSV**)
- **API Endpoint**: `GET /api/logs?project=<projectId>&format=csv`
- **Data file**: `data/runs/<projectId>.jsonl` (also JSON lines format, line-delimited)

### What to capture (screenshot/video)
1. **Audit log table** showing columns:
   - Timestamp (ISO 8601)
   - Event type (TASK_STARTED, POLICY_EVALUATED, COMMAND_APPROVED, COMMAND_DENIED, TASK_DONE, etc.)
   - Project ID
   - Task ID
   - Details (bash command, policy reason, approver)
   
2. **Timestamps precision**: Show that each row is machine-readable (ISO 8601), sortable, and queryable by date range.

3. **Actor tracking**: Show approver column (e.g., "alice@company.com" or "SYSTEM" for automatic gates).

### Reproduction steps
```bash
# Start server
pnpm start

# In browser, navigate to:
# http://127.0.0.1:8788/logs

# Or fetch via API:
curl -s http://127.0.0.1:8788/api/logs?project=agent-dashboard&format=csv \
  | head -20

# Or inspect raw data:
cat data/runs/agent-dashboard.jsonl | jq '.ts, .type, .command' | head -20
```

### Why this matters for Pro
- **Community**: Single-project audit log; each org member manages their own backups.
- **Pro**: Cross-team audit trail with **Activity Export** and **Evidence Bundle**; retention policies, full-text search, role-based access, export for SOC2 compliance.

---

## Proof Point 2: Policy Gates (Fail-Fast Verification)

**What it proves**: Dangerous commands are evaluated against policy before execution; approval is required for high-risk tasks.

**Pain it solves**: "We accidentally ran `rm -rf /` in a critical service. How do we prevent that?"

### Location
- **UI Path**: Menu → **Logs** → Expand any task detail → Look for **"Policy Decision"** section
- **API Endpoint**: `GET /api/policy/evaluate` (when proposing a command)
- **Data file**: `data/policy.json` (policy rules)

### What to capture (screenshot/video)
1. **Policy decision modal** showing:
   - Command: `git push --force` (marked as DANGEROUS)
   - Reason: "Force push can overwrite team history"
   - Action: "APPROVAL_REQUIRED" (red button)
   - Approver dropdown (can choose who to ask)
   
2. **Command blocked**: Show that the command does NOT execute until approved.

3. **Approval log**: After approval, show that event is logged with approver name and timestamp.

### Reproduction steps
```bash
# Start server
pnpm start

# In browser:
# 1. Go to http://127.0.0.1:8788
# 2. Open terminal pane (right side)
# 3. Try typing a dangerous command:
#    git push --force
#    rm -rf /
#    sudo truncate -s 0 /var/log/system.log
# 4. Watch the policy gate reject it with reason

# Or test via API:
curl -X POST http://127.0.0.1:8788/api/policy/evaluate \
  -H 'Content-Type: application/json' \
  -d '{
    "project": "agent-dashboard",
    "bash": "git push --force"
  }' | jq '.requiresApproval, .dangerReason'
```

### Why this matters for Pro
- **Community**: Fixed policy rules; all users with server access can override (honor system).
- **Pro**: Role-based approval (only seniors can override), policy audit, auto-denial with logging, escalation workflows; decisions captured in **Activity Export** and stored in **Spec Vault** for review.

---

## Proof Point 3: Artifacts & Patches (Verifiable Failures)

**What it proves**: When a task fails, the system captures what was attempted (patch, command) and shows output; nothing is lost to history.

**Pain it solves**: "A task failed. What did it try to do? Can I see the diff? What was the error message?"

### Location
- **UI Path**: Menu → **Reports** → Click any project → Expand failed task → **View Artifact** (or **Download Patch**)
- **API Endpoint**: `GET /api/artifact/<projectId>/<taskId>` and `GET /api/patch/<projectId>/<taskId>`
- **Data files**: `data/compliance/<projectId>/<timestamp>/` (artifacts directory)

### What to capture (screenshot/video)
1. **Task card** showing:
   - Task title: "Add memory pool optimization"
   - Status: "FAILED" (red)
   - Reason: "Test suite failed (exit code 1)"
   
2. **Artifact section** with buttons:
   - **View Command**: Shows bash command that was proposed: `npm run test`
   - **View Patch**: Shows the code change:
     ```diff
     - malloc(size)
     + pool.alloc(size)
     ```
   - **View Output**: Shows error:
     ```
     FAIL src/core/memory.test.js
       ✕ Pool refcount
     ```
   
3. **Timing**: Show that artifact was captured immediately after failure (timestamp).

### Reproduction steps
```bash
# Start server
pnpm start

# In browser:
# 1. Go to http://127.0.0.1:8788/reports
# 2. Click any project
# 3. Expand any failed task
# 4. Click "View Artifact" or "Download Patch"

# Or via API:
curl -s http://127.0.0.1:8788/api/artifact/agent-dashboard/task-123 | jq '.'

# Or inspect data directory:
ls -la data/compliance/agent-dashboard/ | head -5
cat data/compliance/agent-dashboard/2026-01-22T06-12-34-000/artifact.json
```

### Why this matters for Pro
- **Community**: Artifacts stored locally; you manage retention; searchable only by filename.
- **Pro**: Artifacts indexed by project, date, task, status; automatic retention policies; full-text search; team sharing with access control; included in the **Evidence Bundle** and archived in **Spec Vault**.

---

## Proof Point 4: Cost Tracking & Budget Control (Visible Cost)

**What it proves**: Every API call is tracked for cost; budget limits are enforced; overage is prevented.

**Pain it solves**: "Our OpenAI bill was $50k last month. Which projects caused it? Can we cap spending?"

### Location
- **UI Path**: Menu → **State** or **Dashboard** → Look for **Cost Summary** card
- **API Endpoint**: `GET /api/cost?project=<projectId>` (get cost breakdown by project)
- **Data file**: `data/cost.json` (cost ledger)

### What to capture (screenshot/video)
1. **Cost Summary card** showing:
   - Total Spend: `$23.45`
   - Budget: `$100.00`
   - Remaining: `$76.55`
   - Projected (based on recent tasks): `$23.40` (for next 100 tasks)
   
2. **Cost breakdown table** (when clicking project):
   - Model name: "gpt-5-mini"
   - Input tokens: 12,345
   - Output tokens: 5,678
   - Cost per task: $0.03
   - Total: $1.50
   
3. **Budget enforcement**: Show that when budget is hit, system pauses tasks with message: "Budget exceeded. Paused. Contact admin to increase limit."

### Reproduction steps
```bash
# Start server
pnpm start

# In browser:
# 1. Go to http://127.0.0.1:8788
# 2. Look at dashboard for "Cost Summary" card
# 3. Click on any project to see breakdown

# Or via API:
curl -s http://127.0.0.1:8788/api/cost?project=agent-dashboard | jq '.'

# Or inspect cost data:
cat data/cost.json | jq '.["agent-dashboard"]'
```

### Why this matters for Pro
- **Community**: Budget per project; cost tracking in local JSON file; you build your own dashboards.
- **Pro**: Team-wide budget pools, cost attribution by user/date, variance alerts, cost optimization recommendations, invoice integration; spend data packaged in **Activity Export** for finance and compliance.

---

## Proof Point 5: Compliance Reports (Audit-Ready Export)

**What it proves**: Compliance data (policy decisions, approvals, cost) can be exported in audit-ready format (CSV, PDF).

**Pain it solves**: "Our auditor needs proof that all dangerous commands required approval. How do we generate a compliance report?"

### Location
- **UI Path**: Menu → **Logs** → Select project → **Download CSV** or **Export PDF**
- **API Endpoint**: `GET /api/logs/<projectId>?format=csv` or `format=pdf`
- **Data files**: CSV exports generated on-demand; raw data in `data/runs/<projectId>.jsonl`

### What to capture (screenshot/video)
1. **Export dialog** showing format options:
   - CSV (full audit trail)
   - PDF (compliance report with summary + timeline)
   - JSON (for programmatic processing)
   
2. **CSV columns** (show in spreadsheet):
   - Timestamp
   - Event Type
   - Project ID
   - Task/Command
   - Severity (CRITICAL, HIGH, LOW, INFO)
   - Approver
   - Reason/Notes
   
3. **PDF report** showing:
   - Title: "Compliance Report: agent-dashboard (2026-01-01 to 2026-01-22)"
   - Summary: "28 tasks, 0 denials, 0 budget overages, 3 dangerous-command approvals"
   - Timeline table (policy decisions only)
   - Signature block (for auditor sign-off)

### Reproduction steps
```bash
# Start server
pnpm start

# In browser:
# 1. Go to http://127.0.0.1:8788/logs
# 2. Select project
# 3. Click "Download CSV" or "Export PDF"

# Or via API:
curl -s http://127.0.0.1:8788/api/logs/agent-dashboard?format=csv > audit.csv
curl -s http://127.0.0.1:8788/api/logs/agent-dashboard?format=pdf > audit.pdf

# Or inspect raw logs:
cat data/runs/agent-dashboard.jsonl | jq 'select(.type == "POLICY_EVALUATED")' | head -5
```

### Why this matters for Pro
- **Community**: CSV export of local logs; you build PDF in Word/Google Docs manually.
- **Pro**: One-click PDF compliance report with legal attestation, cross-project rollup, SOC2-ready format, retention policy proof—delivered as an **Evidence Bundle** alongside **Activity Export** and stored in **Spec Vault**.

---

## Proof Point 6: Real-Time Monitoring (Shared Visibility)

**What it proves**: Multiple team members can see the same dashboard in real-time; live task updates are broadcast to all connected clients.

**Pain it solves**: "Alice started a task. I have no idea if it succeeded. She's in a meeting. How do I know status?"

### Location
- **UI Path**: Main dashboard (http://127.0.0.1:8788) showing live state updates
- **WebSocket Endpoint**: `ws://127.0.0.1:8788` (real-time events)
- **API Endpoint**: `GET /api/state` (current state snapshot)

### What to capture (screenshot/video)
1. **Dashboard state card** showing:
   - Project: "agent-dashboard"
   - Progress: "40%" (with progress bar)
   - Current task: "Optimization pass 2/5"
   - Started: "1 minute ago"
   - Estimated completion: "2 minutes"
   
2. **Real-time updates**: Show the progress bar advancing in real-time as task executes.

3. **Multiple browser windows**: Open dashboard in two browser tabs on same project; show that both update simultaneously (no page refresh needed).

4. **Terminal output**: Show real-time terminal output on right side updating as task progresses.

### Reproduction steps
```bash
# Start server
pnpm start

# In browser:
# 1. Open http://127.0.0.1:8788 in Tab 1
# 2. Open http://127.0.0.1:8788 in Tab 2 (or different browser)
# 3. Watch both dashboards update in lockstep as tasks progress

# Or monitor via API in terminal:
watch -n 1 'curl -s http://127.0.0.1:8788/api/state | jq ".currentPct, .current"'

# Or listen to WebSocket:
# (Requires wscat or similar tool)
# wscat -c ws://127.0.0.1:8788
# (You'll see events: type:'state:updated', type:'cost:updated', etc.)
```

### Why this matters for Pro
- **Community**: Real-time within your local server; only people with server access see it; no history.
- **Pro**: Team-wide real-time dashboard, shared by role (PMs see oversight, engineers see detail), event history queryable, alerts/integrations; history exported in **Activity Export** and preserved in **Spec Vault**.

---

## Screenshot Checklist

Use these proof points to build your **demo video** or **screenshot deck**:

- [ ] **Proof 1**: Audit log table with timestamps and actor names
- [ ] **Proof 2**: Policy gate rejection (before/after)
- [ ] **Proof 3**: Artifact view (command, patch, output)
- [ ] **Proof 4**: Cost summary card + cost breakdown by model
- [ ] **Proof 5**: CSV export + PDF compliance report
- [ ] **Proof 6**: Real-time state updates in two browser windows

---

## Talking Points for Each Proof

| Proof | One-Liner | Pro Upgrade |
|-------|-----------|-------------|
| Audit Trail | "I can trace any action to a timestamp and approver." | Team-wide audit, cross-project search, retention proof for compliance. |
| Policy Gates | "Dangerous commands require approval before execution." | Role-based approval, escalation workflows, auto-denial with audit. |
| Artifacts | "Failed tasks leave behind what was attempted and why." | Indexed artifacts, auto-retention, team sharing, diff visualization. |
| Cost Control | "Every model call is tracked; budget hard-limits prevent overage." | Team budgets, cost attribution by user, variance alerts, forecasts. |
| Compliance | "Audit logs export as CSV/PDF for external auditors." | Legal-grade PDF, cross-project rollup, SOC2 format, retention proof. |
| Real-Time | "Multiple team members see the same dashboard live." | Role-based visibility, alert routing, enterprise SSO, usage analytics. |

---

## Next Steps

1. **Use this guide to record a 5-minute demo video** (proof points 1–4)
2. **Share the video with prospects** (link in email: "See why Shipyard Pro")
3. **Build a slide deck** with one screenshot per proof point
4. **Link from README**: Add [Evidence Pack](EVIDENCE_PACK.md) under "Why Pro"

---

*Last updated: 2026-01-22*
