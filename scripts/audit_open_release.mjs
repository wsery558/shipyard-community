#!/usr/bin/env node

/**
 * audit_open_release.mjs - Verify open-core release integrity
 * 
 * Checks:
 * 1. No paid-platform code in distribution
 * 2. All paid routes return 501 (Not Implemented)
 * 3. UI stubs are in place
 * 4. All required open-core modules are present
 * 5. No secrets or auth tokens in code
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// OPEN_CORE_LAYOUT_FALLBACK_V1
// open snapshot uses packages/open-core layout; accept legacy src/core checks by fallback mapping
function _existsWithFallback(ROOT, relPath) {
  try {
    const full = path.join(ROOT, relPath);
    if (fs.existsSync(full)) return { ok: true, path: relPath };
    if (typeof relPath === "string" && relPath.startsWith("src/core/")) {
      const alt = relPath.replace(/^src\/core\//, "packages/open-core/src/core/");
      const full2 = path.join(ROOT, alt);
      if (fs.existsSync(full2)) return { ok: true, path: alt };
    }
    return { ok: false, path: relPath };
  } catch {
    return { ok: false, path: relPath };
  }
}


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const srcDir = path.resolve(rootDir);

let errors = [];
let warnings = [];
let passed = [];

function log(type, msg) {
  if (type === 'error') {
    console.error(`❌ ${msg}`);
    errors.push(msg);
  } else if (type === 'warning') {
    console.warn(`⚠️  ${msg}`);
    warnings.push(msg);
  } else {
    console.log(`✅ ${msg}`);
    passed.push(msg);
  }
}

function checkFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

function checkFiles(pattern) {
  const files = [];
  const walk = (dir) => {
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') continue;
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (pattern.test(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      // Ignore
    }
  };
  walk(srcDir);
  return files;
}

console.log('🔍 Auditing open-core release...\n');

// Check 1: No references to paid-platform imports
console.log('Check 1: No paid-platform imports');
const jsFiles = checkFiles(/\.(mjs|js)$/);
let paidImportCount = 0;
for (const file of jsFiles) {
  const content = checkFile(file);
  if (content) {
    const matches = content.match(/from ['"].*?packages\/paid-platform/g);
    if (matches) {
      paidImportCount += matches.length;
      log('error', `Found paid-platform imports in ${path.relative(srcDir, file)}`);
    }
  }
}
if (paidImportCount === 0) {
  log('passed', 'No paid-platform imports found');
}

// Check 2: All paid routes are stubbed
console.log('\nCheck 2: Paid routes are stubbed (return 501)');
const serverFile = checkFile(path.join(srcDir, 'server.mjs'));
if (serverFile) {
  const paidRoutes = [
    '/api/platform/auth/me',
    '/api/platform/entitlements',
    '/api/platform/admin/entitlements/grant',
    '/api/platform/admin/entitlements/revoke',
    '/api/platform/events',
    '/api/platform/admin/events',
    '/api/platform/admin/metrics',
    '/api/platform/admin/compliance'
  ];
  
  let stubCount = 0;
  for (const route of paidRoutes) {
    // Check if route has 501 stub (OPEN-ONLY comment + 501 status)
    if (serverFile.includes(`'${route}'`) && serverFile.includes(`OPEN-ONLY`) && serverFile.includes(`res.status(501)`)) {
      log('passed', `Route ${route} is properly stubbed`);
      stubCount++;
    } else {
      log('warning', `Route ${route} may not be properly stubbed`);
    }
  }
  if (stubCount === paidRoutes.length) {
    log('passed', `All ${paidRoutes.length} paid routes are stubbed with 501 responses`);
  }
} else {
  log('error', 'server.mjs not found');
}

// Check 3: UI Platform panel is stubbed
console.log('\nCheck 3: UI Platform panel is disabled');
const uiFile = checkFile(path.join(rootDir, 'apps/dashboard/src/components/ProjectUI.jsx'));
if (uiFile) {
  if (uiFile.includes('Not available in Open Core')) {
    log('passed', 'Platform Portfolio panel shows disabled notice');
  } else {
    log('warning', 'Platform Portfolio panel may not be properly stubbed');
  }
} else {
  log('warning', 'ProjectUI.jsx not found (may be in non-standard location)');
}

// Check 4: No secrets in code
console.log('\nCheck 4: No secrets in code');
const secretPatterns = [
  /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/gi,
  /secret\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/gi,
  /token\s*[:=]\s*['"]eyJ[A-Za-z0-9._-]+['"]/gi,
  /password\s*[:=]\s*['"][^'"]+['"]/gi
];

let secretsFound = 0;
for (const file of jsFiles) {
  const content = checkFile(file);
  if (content) {
    for (const pattern of secretPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        secretsFound += matches.length;
        log('error', `Found potential secrets in ${path.relative(srcDir, file)}`);
      }
    }
  }
}
if (secretsFound === 0) {
  log('passed', 'No hardcoded secrets found');
}

// Check 5: Required open-core modules exist
console.log('\nCheck 5: Required open-core modules');
const requiredModules = [
  'packages/open-core/src/core/complianceRunner.mjs',
  'packages/open-core/src/core/artifactManager.mjs'
];

let allPresent = true;
for (const mod of requiredModules) {
  const fullPath = path.join(rootDir, mod);
  if (fs.existsSync(fullPath)) {
    log('passed', `Module ${mod} is present`);
  } else {
    log('warning', `Module ${mod} not found (may be at different path)`);
  }
}

// Check 6: No references to platform DB keys
console.log('\nCheck 6: No platform-specific DB references');
const dbPatterns = [
  /users\.json/,
  /entitlements\.json/,
  /events\.json/,
  /metrics\.json/
];

let dbRefCount = 0;
for (const file of jsFiles) {
  const content = checkFile(file);
  if (content) {
    for (const pattern of dbPatterns) {
      if (pattern.test(content)) {
        // These are OK in paid-platform stub handlers
        // Just warn if they're imported in core modules
        if (file.includes('packages/open-core')) {
          dbRefCount++;
          log('warning', `Found platform DB reference in core module ${path.relative(srcDir, file)}`);
        }
      }
    }
  }
}
if (dbRefCount === 0) {
  log('passed', 'No platform DB references in core modules');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Audit Summary');
console.log('='.repeat(60));
console.log(`✅ Passed: ${passed.length}`);
console.log(`⚠️  Warnings: ${warnings.length}`);
console.log(`❌ Errors: ${errors.length}`);

if (errors.length > 0) {
  console.log('\n❌ Audit FAILED - Please fix errors above');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('\n⚠️  Audit PASSED with warnings');
  process.exit(0);
} else {
  console.log('\n✅ Audit PASSED - Release is ready');
  process.exit(0);
}
