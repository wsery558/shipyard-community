/**
 * Enhanced Policy Engine
 * 
 * Extends the basic policy evaluation with:
 * - Approval flow tracking
 * - Audit logging for all policy decisions
 * - Policy violation history
 * - Configurable escalation and enforcement
 */

import fs from 'fs';
import path from 'path';
import { evaluateCommandPolicy, loadPolicy } from './policy.mjs';

const AUDIT_LOG_DIR = path.resolve(process.cwd(), 'data', 'policy_audit');

export class PolicyEngine {
  constructor(options = {}) {
    this.enableAuditLogging = options.enableAuditLogging !== false;
    this.autoApprovalThreshold = options.autoApprovalThreshold || 'medium'; // 'low', 'medium', 'high', 'critical'
    this.approvalCallbacks = new Map(); // taskId -> { resolve, reject }
    this.decisions = new Map(); // taskId -> decision
    this.violations = new Map(); // project -> [violations]
    
    this._ensureAuditDir();
  }

  _ensureAuditDir() {
    if (this.enableAuditLogging && !fs.existsSync(AUDIT_LOG_DIR)) {
      fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
    }
  }

  /**
   * Evaluate command and return decision with audit trail
   * @param {string} cmd - Command to evaluate
   * @param {string} projectId - Project context
   * @param {Object} context - Additional context { taskId, userId, runSessionId }
   * @returns {Object} { action, code, reason, requiresApproval, decision }
   */
  evaluateCommand(cmd, projectId = 'default', context = {}) {
    const evaluation = evaluateCommandPolicy(cmd, projectId);
    
    const decision = {
      timestamp: new Date().toISOString(),
      command: cmd.substring(0, 500), // Truncate for logging
      projectId,
      evaluation: {
        action: evaluation.action,
        code: evaluation.code,
        reason: evaluation.reason,
        severity: evaluation.severity
      },
      context: {
        taskId: context.taskId,
        userId: context.userId,
        runSessionId: context.runSessionId
      },
      approved: evaluation.action === 'allow',
      requiresApproval: evaluation.action === 'approval',
      status: evaluation.action === 'allow' ? 'allowed' : 
              evaluation.action === 'approval' ? 'pending_approval' : 
              'denied'
    };

    // Store decision
    if (context.taskId) {
      this.decisions.set(context.taskId, decision);
    }

    // Record in violation history if not allowed
    if (evaluation.action !== 'allow') {
      if (!this.violations.has(projectId)) {
        this.violations.set(projectId, []);
      }
      this.violations.get(projectId).push({
        timestamp: decision.timestamp,
        command: cmd.substring(0, 500),
        severity: evaluation.severity,
        code: evaluation.code,
        action: evaluation.action
      });
    }

    // Audit log
    this._auditLog(decision);

    return decision;
  }

  /**
   * Request approval for a command
   * @param {string} taskId
   * @param {Object} approverInfo - { userId, username, reason }
   * @returns {Promise} resolves with approval result
   */
  async requestApproval(taskId, approverInfo = {}) {
    const decision = this.decisions.get(taskId);
    if (!decision) {
      throw new Error(`No decision found for task ${taskId}`);
    }

    if (!decision.requiresApproval) {
      return {
        approved: true,
        reason: 'No approval required'
      };
    }

    // Create approval request
    const approvalRequest = {
      taskId,
      command: decision.command,
      projectId: decision.projectId,
      severity: decision.evaluation.severity,
      requestedAt: new Date().toISOString(),
      requiredApprovals: this._getRequiredApprovals(decision.evaluation.severity),
      approvals: [],
      status: 'pending'
    };

    // Setup promise for approval response
    const approvalPromise = new Promise((resolve, reject) => {
      this.approvalCallbacks.set(taskId, { resolve, reject, request: approvalRequest });
    });

    this._auditLog({
      type: 'APPROVAL_REQUESTED',
      taskId,
      ...approvalRequest
    });

    return approvalPromise;
  }

  /**
   * Approve a pending command
   * @param {string} taskId
   * @param {Object} approvalInfo - { approverId, approverName, reason }
   */
  approveCommand(taskId, approvalInfo = {}) {
    const callbacks = this.approvalCallbacks.get(taskId);
    if (!callbacks) {
      throw new Error(`No approval request found for task ${taskId}`);
    }

    const request = callbacks.request;
    request.approvals.push({
      approverId: approvalInfo.approverId,
      approverName: approvalInfo.approverName,
      reason: approvalInfo.reason,
      timestamp: new Date().toISOString()
    });

    // Check if we have enough approvals
    if (request.approvals.length >= request.requiredApprovals) {
      request.status = 'approved';
      request.approvedAt = new Date().toISOString();
      
      this._auditLog({
        type: 'APPROVAL_GRANTED',
        taskId,
        ...request
      });

      this.approvalCallbacks.delete(taskId);
      callbacks.resolve({
        approved: true,
        approvals: request.approvals,
        timestamp: request.approvedAt
      });
    }
  }

  /**
   * Reject a pending command
   * @param {string} taskId
   * @param {Object} rejectionInfo - { rejectionReason, rejectorId, rejectorName }
   */
  rejectCommand(taskId, rejectionInfo = {}) {
    const callbacks = this.approvalCallbacks.get(taskId);
    if (!callbacks) {
      throw new Error(`No approval request found for task ${taskId}`);
    }

    const request = callbacks.request;
    request.status = 'rejected';
    request.rejectionReason = rejectionInfo.rejectionReason;
    request.rejectedAt = new Date().toISOString();
    request.rejectorId = rejectionInfo.rejectorId;
    request.rejectorName = rejectionInfo.rejectorName;

    this._auditLog({
      type: 'APPROVAL_REJECTED',
      taskId,
      ...request
    });

    this.approvalCallbacks.delete(taskId);
    callbacks.reject(new Error(`Approval rejected: ${rejectionInfo.rejectionReason}`));
  }

  /**
   * Get required approval count based on severity
   * @private
   */
  _getRequiredApprovals(severity) {
    switch (severity) {
      case 'critical':
        return 2; // Requires 2 approvals
      case 'high':
        return 1; // Requires 1 approval
      case 'medium':
      default:
        return 1; // Requires 1 approval
    }
  }

  /**
   * Write decision to audit log
   * @private
   */
  _auditLog(decision) {
    if (!this.enableAuditLogging) return;

    try {
      const projectId = decision.projectId || decision.context?.projectId || 'default';
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const auditFile = path.join(AUDIT_LOG_DIR, `policy_${projectId}_${dateStr}.jsonl`);
      const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        ...decision
      }) + '\n';
      
      fs.appendFileSync(auditFile, line);
    } catch (err) {
      console.error('[PolicyEngine] Audit log error:', err);
    }
  }

  /**
   * Get list of pending approvals (from evaluated decisions)
   * @returns {Array} [{ taskId, projectId, command, severity, status, timestamp }]
   */
  getPendingApprovals() {
    const out = [];
    for (const [taskId, decision] of this.decisions.entries()) {
      if (decision && decision.requiresApproval && decision.status === 'pending_approval') {
        out.push({
          taskId,
          projectId: decision.projectId,
          command: decision.command,
          severity: decision.evaluation?.severity,
          status: decision.status,
          timestamp: decision.timestamp
        });
      }
    }
    return out;
  }

  /**
   * Inspect approval request (if requestApproval was called)
   */
  getApprovalRequest(taskId) {
    const cb = this.approvalCallbacks.get(taskId);
    return cb ? cb.request : null;
  }

  /**
   * Get policy violations for a project
   */
  getViolations(projectId) {
    return this.violations.get(projectId) || [];
  }

  /**
   * Get audit trail for a task
   */
  getAuditTrail(taskId) {
    const decision = this.decisions.get(taskId);
    return decision || null;
  }

  /**
   * Get summary of policy violations
   */
  getViolationsSummary() {
    const summary = {};
    for (const [projectId, violations] of this.violations) {
      summary[projectId] = {
        total: violations.length,
        bySeverity: violations.reduce((acc, v) => {
          acc[v.severity] = (acc[v.severity] || 0) + 1;
          return acc;
        }, {}),
        byCode: violations.reduce((acc, v) => {
          acc[v.code] = (acc[v.code] || 0) + 1;
          return acc;
        }, {})
      };
    }
    return summary;
  }

  /**
   * Clear violations for a project
   */
  clearViolations(projectId) {
    this.violations.delete(projectId);
  }
}

// Export singleton
let policyEngineInstance = null;

export function getPolicyEngine(options) {
  if (!policyEngineInstance) {
    policyEngineInstance = new PolicyEngine(options);
  }
  return policyEngineInstance;
}

export function resetPolicyEngine() {
  policyEngineInstance = null;
}
