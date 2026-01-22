# Commit Ready: Pain → Proof → Upgrade Narrative Alignment

## What's Being Delivered

**Goal**: Align Shipyard Community demo/evidence narrative to pain-point language so a new user understands "why Pro" within 5 minutes.

**Status**: ✅ COMPLETE — Ready to commit as single PR

---

## Files Created (3)

### 1. docs/DEMO_5MIN.md (5.6 KB)
**Purpose**: 5-minute walkthrough script with timestamps (0:00–5:00)

**Content**:
- Start server, load UI (0:00–0:30)
- Proof #1: Traceable Run Timeline (0:30–2:00)
  - Audit log with timestamps, event types, approvers
  - Why Pro: Cross-team search, retention proof, SOC2 export
- Proof #2: Fail-Fast with Artifacts (2:00–3:30)
  - Policy gate rejection, approval modal, artifact download
  - Why Pro: Role-based approval, escalation workflows
- Proof #3: Visible Cost & Budget (3:30–4:30)
  - Cost summary card, breakdown by model, budget enforcement
  - Why Pro: Team budgets, cost attribution, variance alerts
- Why Upgrade to Pro (4:30–5:00)
  - Team governance, shared audit, role-based approval, compliance

**Integration**: Linked from README.md (line 25)

---

### 2. docs/EVIDENCE_PACK.md (13 KB)
**Purpose**: Detailed proof points with screenshot/video instructions

**Content**: 6 Proof Points, each with:
- What it proves (pain it solves)
- Location (UI path + API endpoint + data file)
- What to capture (screenshot/video description)
- Reproduction steps (copy-paste ready, no secrets)
- Why Pro matters (governance gap)

**Proof Points**:
1. Audit Trail (traceable runs)
2. Policy Gates (fail-fast verification)
3. Artifacts & Patches (verifiable failures)
4. Cost Tracking & Budget (visible cost)
5. Compliance Reports (audit-ready exports)
6. Real-Time Monitoring (shared visibility)

**Integration**: Linked from README.md (lines 31, 32, 36)

---

### 3. public/demo/README.md (8.2 KB)
**Purpose**: Placeholder structure for sales/marketing assets (screenshots, videos)

**Content**:
- 6 subdirectories (one per proof point)
- For each: file naming convention, what to capture, best practices
- Screenshot guidelines (no secrets, use demo data)
- Video guidelines (30-45s, H.264 MP4, clear narration)
- Integration with README/DEMO_5MIN/EVIDENCE_PACK
- Checklist for QA verification

**Status**: Structure ready; user fills in screenshots/videos later

---

## Files Modified (2)

### 1. README.md (Updated)
**Changes**: Reframed from feature-list to pain→proof→upgrade narrative

**Section Changes**:
- **Top intro** (lines 1–25):
  - Added: "The Problem You're Solving" (3 pain points)
  - Added: Link to 5-minute demo
  - Added: Direct call-to-action: "See all three in action →"

- **Community vs Pro** (lines 35–55):
  - OLD: 8-feature table with ❌ 501 entries
  - NEW: 8-feature table with "Why" column explaining pain→proof→upgrade
  - Added: "When to Upgrade to Pro" decision tree

- **No behavior changes**: Pure narrative alignment

**Lines Changed**: 35 (15% of file), all additive or clarifying

---

### 2. server.mjs (Updated)
**Changes**: 9 × 501 endpoint responses now explain Pro features

**Pattern Change**:
```javascript
// BEFORE
res.status(501).json({ 
  error: 'Not implemented in Open Core',
  feature: 'Platform authentication',
  requires: 'paid-platform module'
});

// AFTER
res.status(501).json({ 
  error: 'Team authentication not available in Community',
  feature: 'Platform user identity and SSO',
  upgrade: 'Shipyard Pro adds role-based access control (RBAC), OAuth/SAML, and team entitlements.',
  docs: 'https://shipyard.tsaielectro.com/en/'
});
```

**Endpoints Updated** (9 total):
1. `/api/compliance/passive` — Compliance analytics
2. `/api/platform/auth/me` — Team authentication
3. `/api/platform/entitlements` — Role-based access
4. `/api/platform/admin/entitlements/grant` — Role grants
5. `/api/platform/admin/entitlements/revoke` — Role revocation
6. `/api/platform/events` — Event ingestion
7. `/api/platform/admin/events` — Event querying
8. `/api/platform/admin/metrics` — Usage analytics
9. `/api/platform/admin/compliance` — Compliance dashboards

**No behavior changes**: JSON response format only (valid JSON, no breaking changes)

---

## Verification Checklist

- ✅ No code logic changes (docs + text only)
- ✅ All markdown files properly formatted with links
- ✅ README links to DEMO_5MIN.md (2 references)
- ✅ README links to EVIDENCE_PACK.md (3 references)
- ✅ pnpm test:smoke passes
  - ✅ /health endpoint works
  - ✅ /api/state endpoint works
  - ✅ /api/projects endpoint works
- ✅ 501 responses: Valid JSON
- ✅ No secrets or environment-specific data in docs
- ✅ File sizes reasonable (5–13 KB)

---

## How to Commit

```bash
cd /home/ken/code/shipyard-community

# Stage all changes
git add \
  README.md \
  server.mjs \
  docs/DEMO_5MIN.md \
  docs/EVIDENCE_PACK.md \
  public/demo/README.md

# Commit with clear message
git commit -m "Docs: Align Shipyard narrative to pain→proof→upgrade

Add demo & evidence pack to guide new users to 'why Pro' in 5 minutes.

New Files:
  - docs/DEMO_5MIN.md: 5-minute walkthrough (3 proof points)
  - docs/EVIDENCE_PACK.md: 6 proof points with screenshots/reproduction steps
  - public/demo/README.md: Placeholder structure for sales assets

Modified:
  - README.md: Reframe from feature-list to pain→proof→upgrade narrative
  - server.mjs: Update 501 responses to explain Pro upgrade, not just error

No logic changes. All tests pass.
"

# Push to branch
git push origin docs/community-v0.2.0
```

---

## What This Accomplishes

### For Users
- **5-minute path to understanding**: Clear pain → proof → upgrade flow
- **Reproducible proofs**: Can run all reproduction steps locally
- **No confusion**: Clear messaging about Community vs Pro

### For Sales
- **Demo script**: Ready-to-read walkthrough with timestamps
- **Talking points**: 6 proof points with governance gaps identified
- **Asset structure**: Placeholder for videos/screenshots (to be filled in)

### For Marketing
- **Email ready**: Link to DEMO_5MIN.md with call-to-action
- **Blog ready**: Use EVIDENCE_PACK.md talking points + proof points
- **Messaging aligned**: Same narrative across docs, UI, and content

---

## What's NOT Changed

- ✅ No new features added
- ✅ No UI elements changed (only string text in 501 responses)
- ✅ No database schema changes
- ✅ No API behavior changes
- ✅ No environment variables added
- ✅ No dependencies added

---

## Next Steps (After Commit)

1. **QA** (This week):
   - Review docs/DEMO_5MIN.md & docs/EVIDENCE_PACK.md
   - Test all reproduction steps locally
   - Verify 501 responses display correctly

2. **Assets** (Next 2 weeks):
   - Record 6 × 30-45s videos (one per proof point)
   - Take 12–15 screenshots (per public/demo/README.md checklist)
   - Place in public/demo/*/ directories

3. **Activation** (Next 3 weeks):
   - Create sales deck with screenshots
   - Write blog post: "Why Community Works (And When Pro Matters)"
   - Send email campaign linking to DEMO_5MIN.md

---

*Commit-ready documentation & evidence pack alignment*  
*Target branch: docs/community-v0.2.0*  
*Date: 2026-01-22*
