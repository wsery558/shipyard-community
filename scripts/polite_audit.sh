#!/bin/bash
# Polite audit: check tracked files for privacy/security issues before OSS release
# Exit 0 if all checks pass, non-zero if any fail

set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAIL_COUNT=0

echo "════════════════════════════════════════════════"
echo "  Shipyard Community — Polite Audit"
echo "════════════════════════════════════════════════"
echo ""

# Check 1: No node_modules or ui-dist tracked
echo "1️⃣  Checking for tracked build artifacts..."
ARTIFACTS=$(git ls-files | grep -E '^(node_modules/|ui-dist/|dist/)' || true)
if [ -z "$ARTIFACTS" ]; then
  echo -e "   ${GREEN}✅ PASS${NC} — No build artifacts tracked"
else
  echo -e "   ${RED}❌ FAIL${NC} — Build artifacts found in git:"
  echo "$ARTIFACTS" | head -5
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Check 2: No real emails (only shipyard.tsaielectro.com/en allowed)
echo "2️⃣  Checking for real email addresses..."
REAL_EMAILS=$(git ls-files -z | xargs -0 grep -niE --exclude='polite_audit.sh' '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|org|net|io|dev)' 2>/dev/null | grep -v '@example\.com' | grep -v 'github.com' | grep -v 'rollupjs.org' || true)
if [ -z "$REAL_EMAILS" ]; then
  echo -e "   ${GREEN}✅ PASS${NC} — No real email addresses found"
else
  echo -e "   ${RED}❌ FAIL${NC} — Real email addresses detected:"
  echo "$REAL_EMAILS" | head -5
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Check 3: No secret-like patterns
echo "3️⃣  Checking for secret-like patterns..."
SECRETS=$(git ls-files -z | xargs -0 grep -niE --exclude='polite_audit.sh' 'gho_[a-zA-Z0-9]{36}|ghp_[a-zA-Z0-9]{36}|sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|AIza[a-zA-Z0-9_-]{35}|BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY|ssh-rsa AAAA' 2>/dev/null || true)
if [ -z "$SECRETS" ]; then
  echo -e "   ${GREEN}✅ PASS${NC} — No secrets detected"
else
  echo -e "   ${RED}❌ FAIL${NC} — Secret-like patterns found:"
  echo "$SECRETS" | head -5
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Check 4: Required docs exist
echo "4️⃣  Checking for required documentation..."
MISSING_DOCS=""
for doc in "docs/OPEN_DELIVERY.md" "docs/SECURITY.md" "CODE_OF_CONDUCT.md" "LICENSE" "README.md"; do
  if [ ! -f "$doc" ]; then
    MISSING_DOCS="${MISSING_DOCS}   - $doc\n"
  fi
done

if [ -z "$MISSING_DOCS" ]; then
  echo -e "   ${GREEN}✅ PASS${NC} — All required docs present"
else
  echo -e "   ${RED}❌ FAIL${NC} — Missing documentation:"
  echo -e "$MISSING_DOCS"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Summary
echo "════════════════════════════════════════════════"
if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✅ POLITE AUDIT PASSED${NC}"
  echo "Repository is ready for OSS release"
  echo "════════════════════════════════════════════════"
  exit 0
else
  echo -e "${RED}❌ POLITE AUDIT FAILED${NC}"
  echo "Found $FAIL_COUNT issue(s) — fix before OSS release"
  echo "════════════════════════════════════════════════"
  exit 1
fi
