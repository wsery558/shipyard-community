/**
 * Policy-as-Code for dangerous commands
 *
 * Supports allow/deny/approval rules with regex matching.
 * Default policy is built-in; file override at data/policy.json (JSON or YAML-like JSON).
 */

import fs from 'fs';
import path from 'path';

const POLICY_FILE = path.resolve(process.cwd(), 'data', 'policy.json');

// Built-in defaults
const DEFAULT_POLICY = {
  version: 1,
  rules: [
    {
      id: 'deny-rm-rf-root',
      action: 'deny',
      pattern: /rm\s+-rf\s+(\/|~|\.\/|\.\.\/|\/tmp|\.(?:\s|$))/i,
      reason: 'rm -rf detected - destructive',
      severity: 'critical',
      code: 'DANGER_RM_RF_ROOT'
    },
    {
      id: 'deny-mkfs',
      action: 'deny',
      pattern: /\bmkfs\b/i,
      reason: 'mkfs detected - destructive',
      severity: 'critical',
      code: 'DANGER_MKFS'
    },
    {
      id: 'deny-dd-destructive',
      action: 'deny',
      pattern: /\bdd\b[^\n]*\bif=.*\bof=/i,
      reason: 'dd if=...of=... detected - destructive',
      severity: 'high',
      code: 'DANGER_DD_DESTRUCTIVE'
    },
    {
      id: 'approval-chmod-777',
      action: 'approval',
      pattern: /\bchmod\s+777\b/i,
      reason: 'chmod 777 detected - requires approval',
      severity: 'medium',
      code: 'DANGER_CHMOD_777'
    },
    {
      id: 'approval-curl-pipe-sh',
      action: 'approval',
      pattern: /curl[^\n]*\|\s*sh/i,
      reason: 'curl | sh detected - requires approval',
      severity: 'high',
      code: 'DANGER_CURL_PIPE_SH'
    },
    {
      id: 'approval-shutdown',
      action: 'approval',
      pattern: /\bshutdown\b|\breboot\b/i,
      reason: 'shutdown/reboot detected - requires approval',
      severity: 'high',
      code: 'DANGER_SHUTDOWN'
    },
    {
      id: 'approval-sudo-shutdown',
      action: 'approval',
      pattern: /\bsudo\b.*\bshutdown\b|\bsudo\b.*\breboot\b/i,
      reason: 'sudo shutdown/reboot detected - requires approval',
      severity: 'high',
      code: 'DANGER_SHUTDOWN'
    },
    {
      id: 'deny-fork-bomb',
      action: 'deny',
      pattern: /:[()]{:|:&[}];:/i,
      reason: 'fork bomb detected - destructive',
      severity: 'critical',
      code: 'DANGER_FORK_BOMB'
    }
  ]
};

let cachedPolicy = null;

function loadPolicyFile() {
  try {
    if (!fs.existsSync(POLICY_FILE)) return null;
    const content = fs.readFileSync(POLICY_FILE, 'utf8');
    // Accept JSON; YAML is not required—keeping simple.
    return JSON.parse(content);
  } catch (e) {
    console.error('[policy] Failed to load policy file, falling back to defaults:', e.message);
    return null;
  }
}

export function loadPolicy() {
  if (cachedPolicy) return cachedPolicy;
  const filePolicy = loadPolicyFile();
  cachedPolicy = normalizePolicy(filePolicy || DEFAULT_POLICY);
  return cachedPolicy;
}

function normalizePolicy(policy) {
  if (!policy || !Array.isArray(policy.rules)) return { ...DEFAULT_POLICY };
  const normalized = { version: policy.version || 1, rules: [] };
  for (const rule of policy.rules) {
    if (!rule || !rule.pattern || !rule.action) continue;
    try {
      const re = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
      normalized.rules.push({
        id: rule.id || rule.code || `rule_${normalized.rules.length + 1}`,
        action: rule.action, // 'allow' | 'deny' | 'approval'
        pattern: re,
        reason: rule.reason || 'policy rule matched',
        severity: rule.severity || 'medium',
        code: rule.code || rule.id || 'POLICY_MATCH'
      });
    } catch (e) {
      // skip invalid regex
      continue;
    }
  }
  if (normalized.rules.length === 0) return { ...DEFAULT_POLICY };
  return normalized;
}

/**
 * Evaluate a command against policy rules.
 * @param {string} cmd
 * @param {string} project
 * @returns {Object} { action: 'allow' | 'deny' | 'approval', code?, reason?, severity? }
 */
export function evaluateCommandPolicy(cmd, project = 'default') {
  const s = (cmd || '').trim();
  if (!s) return { action: 'allow' };
  const policy = loadPolicy();
  for (const rule of policy.rules) {
    if (rule.pattern.test(s)) {
      return {
        action: rule.action === 'approval' ? 'approval' : rule.action === 'deny' ? 'deny' : 'allow',
        code: rule.code,
        reason: rule.reason,
        severity: rule.severity,
        project
      };
    }
  }
  return { action: 'allow' };
}

export function clearPolicyCache() {
  cachedPolicy = null;
}
