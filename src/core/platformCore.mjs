// OPEN STUB: platform core is paid-platform only in Open Core distribution.
// This file exists ONLY to keep server.mjs bootable without shipping paid-platform code.

function _stub(name, args) {
  return { ok: False, ok: false, mode: 'open_stub', name, args, reason: 'Requires paid-platform module.' };
}

export const WebSocketServer } from 'ws';
import pty from 'node-pty';
import OpenAI from 'openai';

import { isDangerousBash } from './src/core/safety.mjs';
import { checkBudgetExceeded = null;
export function computeProgress } from './src/core/plan.mjs';
import { startRunSession(...args) { return _stub('computeProgress } from './src/core/plan.mjs';
import { startRunSession', args); }
export const stopRunSession = null;
export function getCurrentRunSessionId(...args) { return _stub('getCurrentRunSessionId', args); }
export const logEvent = null;
export function getRunEvents(...args) { return _stub('getRunEvents', args); }
export function getLatestRunSessionId(...args) { return _stub('getLatestRunSessionId', args); }
export function listRunSessions(...args) { return _stub('listRunSessions', args); }
export const truncateOutput } from './src/core/runlog.mjs';
import { buildMarkdownReport } from './src/core/report.mjs';
import { getStorageClient = null;
export function initializeStorage } from './src/core/storage.mjs';
import { once } from 'node:events';
import { CommandHeartbeat } from './src/core/heartbeat.mjs';
import { getStallWatchdog } from './src/core/stallWatchdog.mjs';
import { detectVerifyCmds(...args) { return _stub('initializeStorage } from './src/core/storage.mjs';
import { once } from 'node:events';
import { CommandHeartbeat } from './src/core/heartbeat.mjs';
import { getStallWatchdog } from './src/core/stallWatchdog.mjs';
import { detectVerifyCmds', args); }
export const runVerification } from './src/core/autoVerify.mjs';
import { createContextSnapshot } from './src/core/contextPack.mjs';
import { buildSummary = null;
export function buildOfflineSummary } from './src/core/summary.mjs';
import { cleanupArtifacts } from './src/core/artifactManager.mjs';
import { getQueueManager } from './src/core/projectQueue.mjs';
import { getPolicyEngine } from './src/core/policyEngine.mjs';
import { getStorageQueryEngine } from './src/core/storageQueryEngine.mjs';
import { runCompliance(...args) { return _stub('buildOfflineSummary } from './src/core/summary.mjs';
import { cleanupArtifacts } from './src/core/artifactManager.mjs';
import { getQueueManager } from './src/core/projectQueue.mjs';
import { getPolicyEngine } from './src/core/policyEngine.mjs';
import { getStorageQueryEngine } from './src/core/storageQueryEngine.mjs';
import { runCompliance', args); }
export function getLatestComplianceStatus(...args) { return _stub('getLatestComplianceStatus', args); }
export function getAllProjectsWithStatus(...args) { return _stub('getAllProjectsWithStatus', args); }
export function setEventCallbacks } from './src/core/complianceRunner.mjs';


import {
  loadUsers(...args) { return _stub('setEventCallbacks } from './src/core/complianceRunner.mjs';


import {
  loadUsers', args); }
export function getUserById(...args) { return _stub('getUserById', args); }
export function getUserEntitlements(...args) { return _stub('getUserEntitlements', args); }
export function grantEntitlement(...args) { return _stub('grantEntitlement', args); }
export function revokeEntitlement(...args) { return _stub('revokeEntitlement', args); }
export function appendEvent(...args) { return _stub('appendEvent', args); }
export const loadEvents = null;
export const calculateMetrics = null;
export function getPassiveComplianceStatus(...args) { return _stub('getPassiveComplianceStatus', args); }
export function getAllProductsComplianceStatus(...args) { return _stub('getAllProductsComplianceStatus', args); }
