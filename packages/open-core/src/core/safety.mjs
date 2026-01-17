/**
 * Safety checks for bash commands
 */

import { evaluateCommandPolicy } from './policy.mjs';

// Danger codes (stable enum for testing)
export const DANGER_CODES = {
  RM_RF_ROOT: 'DANGER_RM_RF_ROOT',
  MKFS: 'DANGER_MKFS',
  DD_DESTRUCTIVE: 'DANGER_DD_DESTRUCTIVE',
  SHUTDOWN: 'DANGER_SHUTDOWN',
  FORK_BOMB: 'DANGER_FORK_BOMB',
};

/**
 * Check if bash command is dangerous via Policy-as-Code rules.
 * @param {string} cmd - Bash command to check
 * @param {string} project - project id for context (optional)
 * @returns {Object} { danger: boolean, requiresApproval?: boolean, code?: string, reason?: string, action?: string }
 */
export function isDangerousBash(cmd, project = 'default') {
  const result = evaluateCommandPolicy(cmd, project);
  if (result.action === 'allow') return { danger: false };
  const requiresApproval = result.action === 'approval';
  return {
    danger: true,
    requiresApproval,
    action: result.action,
    code: result.code,
    reason: result.reason,
    severity: result.severity,
  };
}
