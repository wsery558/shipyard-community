# Security Policy

## Open Core Release

This is the **open-source core** of Agent Dashboard. It contains no authentication, no remote connectivity, and no external dependencies beyond standard Node.js modules.

### What's NOT Included

- **Platform authentication** (OAuth, SAML, SSO)
- **Cloud connectivity** (API calls to cloud services)
- **Commercial licensing** (license key validation)
- **Entitlement checking** (license feature gates)
- **Event ingestion** (analytics/telemetry)
- **Compliance reporting** (industry-specific audit trails)

All paid-platform features return HTTP 501 (Not Implemented) with clear error messages.

### Security Properties

✅ **Fully Offline** - No external network calls  
✅ **No Secrets** - No API keys, tokens, or credentials  
✅ **File-Based** - All state in local JSON files  
✅ **Transparent** - All code is open source  
✅ **Self-Contained** - Single Node.js process  

### Local Storage

- **data/state.json** - Execution state
- **data/cost.json** - Cost tracking
- **data/projects.json** - Project registry
- **data/plans/** - Planning configurations
- **data/usage/** - Usage logs

### Audit Log

The **scripts/audit_open_release.mjs** script verifies:
- No paid-platform imports
- No hardcoded secrets
- All required modules present
- Paid routes properly stubbed

Run before deploying:
```bash
pnpm audit:open
```

### Reporting Issues

If you find a security issue in the open-core code:
1. **Do NOT** open a public issue
2. Email tsaielectro0628@gmail.com with:
   - Description of the issue
   - Steps to reproduce
   - Potential impact

## Compliance

This open-core release is **not subject to compliance requirements**. It contains:
- No user PII
- No audit trails
- No encryption requirements
- No key management

Use in production with these constraints in mind.
