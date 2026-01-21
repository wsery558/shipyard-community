# Demo Evidence: Screenshots & Videos

This folder holds the **visual proof** that Community solves the three core problems, and why Pro addresses them at scale.

## Proof Points to Capture

Use the guide in [docs/EVIDENCE_PACK.md](../../docs/EVIDENCE_PACK.md) to record or screenshot each proof. Place files in the subdirectories below.

---

## 📋 Proof 1: Complete Audit Trail (Traceable Runs)

**File**: `audit-trail/`  
**What**: Screenshot or video of audit log table showing timestamps, event types, and approver names.  
**Why Pro**: Cross-team audit search, legal-grade retention proof, SOC2 export.

### To Capture
1. Start server: `pnpm start`
2. Open: http://127.0.0.1:8788/logs
3. Click **View Audit Log** or **Download CSV**
4. Screenshot the table showing:
   - Timestamp (ISO 8601)
   - Event type (TASK_STARTED, POLICY_EVALUATED, etc.)
   - Approver name (or SYSTEM)
   - Details (command, reason)

### Files to Add
- `proof-1-audit-trail-screenshot.png` — Full audit log table
- `proof-1-csv-export.csv` — Sample CSV download (first 10 rows, no secrets)
- `proof-1-video-walkthrough.mp4` — 30-second video showing log filtering

---

## ✋ Proof 2: Policy Gates (Fail-Fast Verification)

**File**: `policy-gates/`  
**What**: Screenshot or video of dangerous command being rejected by policy, then approved.  
**Why Pro**: Role-based approval, escalation workflows, audit trail of all overrides.

### To Capture
1. Start server: `pnpm start`
2. Open terminal pane (right side of dashboard)
3. Type a dangerous command: `git push --force` or `rm -rf /`
4. Screenshot the **Policy Decision** modal showing:
   - Command marked as DANGEROUS
   - Reason for rejection
   - Approval required (red button)
5. After approval, show the event logged

### Files to Add
- `proof-2-policy-gate-rejection.png` — Blocked command with reason
- `proof-2-approval-modal.png` — Approval dialog
- `proof-2-audit-log-entry.png` — Logged approval event
- `proof-2-video-walkthrough.mp4` — 30-second video of full flow

---

## 🔍 Proof 3: Artifacts & Patches (Verifiable Failures)

**File**: `artifacts/`  
**What**: Screenshot or video of failed task showing command, patch, and error output.  
**Why Pro**: Indexed artifacts, searchable by date/project, auto-retention policies.

### To Capture
1. Start server: `pnpm start`
2. Go to **Reports** menu
3. Click any project
4. Expand a **failed** or **blocked** task
5. Screenshot each section:
   - Command proposed (e.g., `npm run test`)
   - Patch generated (code diff)
   - Output (error message)

### Files to Add
- `proof-3-failed-task-card.png` — Task status and summary
- `proof-3-command-proposed.png` — Bash command that was attempted
- `proof-3-patch-diff.png` — Code patch (git diff format)
- `proof-3-error-output.png` — Stdout/stderr output
- `proof-3-video-walkthrough.mp4` — 30-second video of full flow

---

## 💰 Proof 4: Cost Tracking & Budget Control (Visible Cost)

**File**: `cost-control/`  
**What**: Screenshot or video of cost summary and per-model breakdown.  
**Why Pro**: Team budgets, cost attribution by user, variance alerts, forecasts.

### To Capture
1. Start server: `pnpm start`
2. Go to dashboard (main page)
3. Look for **Cost Summary** card
4. Screenshot:
   - Total Spend vs Budget
   - Remaining budget
   - Projected cost
5. Click project to see breakdown:
   - Model name
   - Input/output tokens
   - Cost per task
   - Total

### Files to Add
- `proof-4-cost-summary-card.png` — Budget overview
- `proof-4-cost-breakdown-table.png` — Per-model cost breakdown
- `proof-4-budget-limit-alert.png` — "Budget exceeded" message when limit hit
- `proof-4-video-walkthrough.mp4` — 45-second video showing cost details

---

## 📄 Proof 5: Compliance Reports (Audit-Ready Export)

**File**: `compliance/`  
**What**: Screenshot or PDF of exported compliance report (CSV or PDF format).  
**Why Pro**: One-click SOC2-ready PDF, cross-project rollup, retention proof.

### To Capture
1. Start server: `pnpm start`
2. Go to **Logs** menu
3. Select project
4. Click **Download CSV** or **Export PDF**
5. Screenshot or open the file and show:
   - CSV columns: Timestamp, Event Type, Command, Approver, Reason
   - PDF header: Title, date range, summary
   - Both formats should look professional

### Files to Add
- `proof-5-csv-export-columns.png` — CSV header + first 5 rows (no secrets)
- `proof-5-pdf-report-page1.png` — PDF page 1 showing title and summary
- `proof-5-pdf-report-timeline.png` — PDF table of policy decisions with timestamps
- `proof-5-video-export-flow.mp4` — 30-second video of download/export

---

## 👥 Proof 6: Real-Time Monitoring (Shared Visibility)

**File**: `realtime/`  
**What**: Screenshot or video of dashboard updating in real-time as tasks progress.  
**Why Pro**: Team-wide shared dashboard, role-based visibility, live alerts.

### To Capture
1. Start server: `pnpm start`
2. Open dashboard in **two browser tabs** (or windows)
3. Start a task in one tab
4. Show both dashboards updating **simultaneously** without refresh
5. Screenshot:
   - Progress bar advancing
   - Current task description
   - Estimated completion time
   - Terminal output updating in real-time

### Files to Add
- `proof-6-dashboard-t0.png` — Dashboard before task starts
- `proof-6-dashboard-t30s.png` — Dashboard 30 seconds into task
- `proof-6-dashboard-t1m.png` — Dashboard 1 minute into task (progress visible)
- `proof-6-dual-browser-sync.png` — Two browser windows showing same state (side-by-side)
- `proof-6-video-realtime-updates.mp4` — 45-second video of live progress + terminal output

---

## 🎬 How to Use These Files

### For Sales Demos
- Open `proof-1-audit-trail-screenshot.png` during "traceable runs" discussion
- Play `proof-4-video-walkthrough.mp4` when talking about cost control
- Show `proof-2-policy-gate-rejection.png` as proof of fail-fast behavior

### For Marketing
- Use `proof-3-error-output.png` in "why Community works" blog post
- Feature `proof-6-dual-browser-sync.png` in "Shipyard Pro is better because..." email
- Link `proof-5-pdf-report-page1.png` in "compliance" landing page

### For Blog / Docs
- Embed `proof-1-video-walkthrough.mp4` in [docs/DEMO_5MIN.md](../../docs/DEMO_5MIN.md)
- Reference `proof-4-cost-breakdown-table.png` in cost-control guide
- Show `proof-2-approval-modal.png` in policy documentation

---

## 📝 Screenshot Best Practices

- **No secrets**: Never include API keys, personal project names, or real email addresses
- **Use demo data**: Use the sample projects in `data/projects.json` (agent-dashboard, demo-project, etc.)
- **High contrast**: Ensure text is readable (dark mode vs light background)
- **Timestamp visible**: Show server timestamp if available (proves it's recent)
- **Labels**: Add arrows or text overlays explaining key UI elements

---

## 🎥 Video Best Practices

- **Narration**: Explain what you're clicking and why (optional but recommended)
- **Resolution**: 1920x1080 or higher for readability
- **Duration**: 30-45 seconds per proof point
- **Format**: MP4 (H.264) for broad compatibility
- **Audio**: Clear audio, no background noise (or transcribe narration as text overlay)

---

## Integration with README

These proof points are referenced in:
- [README.md](../../README.md#why-pro) — Why Pro section
- [docs/DEMO_5MIN.md](../../docs/DEMO_5MIN.md) — 5-minute walkthrough
- [docs/EVIDENCE_PACK.md](../../docs/EVIDENCE_PACK.md) — Detailed proof points

**Link from README**: Add to README after "Why Pro" section:
```markdown
## See It in Action

[Evidence pack with screenshots →](docs/EVIDENCE_PACK.md)  
[5-minute video demo →](public/demo/) (coming soon)
```

---

## Checklist

- [ ] Proof 1: Audit trail screenshot + CSV sample
- [ ] Proof 2: Policy gate rejection + approval modal + audit log
- [ ] Proof 3: Failed task card + command + patch + output
- [ ] Proof 4: Cost summary + breakdown table + budget alert
- [ ] Proof 5: CSV export + PDF report (page 1 + timeline)
- [ ] Proof 6: Dashboard at T0 + T30s + T1m + dual-browser sync
- [ ] All 6 videos (30-45s each) recorded and compressed
- [ ] README review: Are links working? Any missing images?

---

*Last updated: 2026-01-22*
*Instructions for capturing proof points: See [docs/EVIDENCE_PACK.md](../../docs/EVIDENCE_PACK.md)*
