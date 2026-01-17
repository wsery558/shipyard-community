/**
 * Compliance Runner - Execute compliance checks on projects
 *
 * Features:
 * - Read project registry
 * - Execute commands or URL-based compliance checks
 * - Collect evidence (stdout, stderr, results)
 * - Respect existing policy/danger gating
 * - Persist results to artifact storage
 *
 * Note: Event emission is optional and can be injected by paid-platform module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { registerArtifact, loadArtifactIndex } from './artifactManager.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.resolve(process.cwd(), 'data', 'projects_registry.json');
const COMPLIANCE_DIR = path.resolve(process.cwd(), 'data', 'compliance');

// Evidence storage configuration
const EVIDENCE_MAX_SIZE = 10 * 1024 * 1024; // 10MB per evidence file

// Injectable event emitter (provided by paid-platform or stubbed)
let eventEmitter = null;
let eventLoader = null;

/**
 * Set event emission callbacks (provided by paid-platform module)
 * @param {function} emitFn - Function to emit events: (eventData) => void
 * @param {function} loadFn - Function to load events: (filters) => array
 */
export function setEventCallbacks(emitFn, loadFn) {
  eventEmitter = emitFn;
  eventLoader = loadFn;
}

/**
 * Load projects registry
 */
function loadRegistry() {
  try {
    if (!fs.existsSync(REGISTRY_PATH)) {
      return { projects: [] };
    }
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    return data;
  } catch (e) {
    console.error('Error loading registry:', e);
    return { projects: [] };
  }
}

/**
 * Ensure evidence directory exists for project
 */
function ensureEvidenceDir(projectId, timestamp) {
  const dir = path.join(COMPLIANCE_DIR, projectId, timestamp);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function runContractEnforcer(project, evidenceDir) {
  const expectedContractVersion = project.expected?.contractVersion || null;
  const expectedPconstHash = project.expected?.pconstHash || null;
  const requiredEvents = project.expected?.requiredEvents || [];
  const pconstPath = project.expected?.pconstPath || path.join(project.repoPath || process.cwd(), 'PCONST.md');

  const result = {
    name: 'contract-enforcer',
    status: 'compliant',
    reason: 'All contract checks passed',
    evidencePath: `compliance/${project.projectId}/${path.basename(evidenceDir)}`,
    details: {
      expectedVersion: expectedContractVersion,
      expectedHash: expectedPconstHash,
      pconstPath,
      missingFields: []
    }
  };

  const issues = [];
  let actualHash = null;
  let parsedVersion = null;

  if (!fs.existsSync(pconstPath)) {
    issues.push('pconst_missing');
    result.details.missingFields.push('pconst_missing');
  } else {
    const content = fs.readFileSync(pconstPath, 'utf8');
    actualHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const versionLine = lines.find(l => /^version[:\s]/i.test(l)) || lines[0];
    if (versionLine) {
      const m = versionLine.match(/version[:\s]+(.+)/i);
      parsedVersion = m ? m[1].trim() : versionLine.trim();
    }

    if (expectedContractVersion && parsedVersion && parsedVersion !== expectedContractVersion) {
      issues.push('version_mismatch');
      result.details.missingFields.push('version_mismatch');
    }
    if (expectedPconstHash && actualHash && expectedPconstHash !== actualHash) {
      issues.push('hash_mismatch');
      result.details.missingFields.push('hash_mismatch');
    }
  }

  // Load events if emitter is set up (provided by paid-platform)
  const events = eventLoader ? eventLoader({ product_id: project.projectId, limit: 500 }) : [];
  const eventTypes = new Set(events.map(e => e.type));
  const missingEvents = requiredEvents.filter(evt => !eventTypes.has(evt));
  if (missingEvents.length) {
    issues.push('required_events_missing');
    result.details.missingFields.push('required_events_missing');
  }

  result.details.actualVersion = parsedVersion;
  result.details.actualHash = actualHash;
  result.details.requiredEvents = requiredEvents;
  result.details.missingEvents = missingEvents;
  result.details.presentEvents = Array.from(eventTypes);

  if (issues.length === 0) {
    result.status = 'compliant';
    result.reason = 'Contract checks passed';
  } else if (issues.length === 1 && issues.includes('required_events_missing')) {
    result.status = 'partial';
    result.reason = 'Missing required events';
  } else {
    result.status = 'non_compliant';
    result.reason = issues.join(',');
  }

  const contractEvidencePath = path.join(evidenceDir, 'contract_enforcer.json');
  fs.writeFileSync(contractEvidencePath, JSON.stringify(result.details, null, 2), 'utf8');
  result.details.evidenceFile = contractEvidencePath;

  return result;
}

/**
 * Execute a single compliance command with timeout
 * @param {string} cmd - Command to execute
 * @param {number} timeoutMs - Timeout in milliseconds (default 5000)
 * @returns {object} { stdout, stderr, exitCode }
 */
function executeCommand(cmd, timeoutMs = 5000) {
  try {
    const stdout = execSync(cmd, {
      timeout: timeoutMs,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      maxBuffer: EVIDENCE_MAX_SIZE
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (e) {
    return {
      stdout: e.stdout ? String(e.stdout) : '',
      stderr: e.stderr ? String(e.stderr) : String(e),
      exitCode: e.status || 1
    };
  }
}

/**
 * Fetch URL-based compliance check
 * @param {string} url - URL to fetch
 * @param {number} timeoutMs - Timeout in milliseconds (default 10000)
 * @returns {object} { body, status, error }
 */
async function fetchComplianceUrl(url, timeoutMs = 10000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > EVIDENCE_MAX_SIZE) {
      return {
        body: `Response too large (${contentLength} bytes, max ${EVIDENCE_MAX_SIZE})`,
        status: response.status,
        error: 'SIZE_LIMIT_EXCEEDED'
      };
    }

    const body = await response.text();
    return {
      body: body.length > EVIDENCE_MAX_SIZE ? body.slice(0, EVIDENCE_MAX_SIZE) : body,
      status: response.status,
      error: null
    };
  } catch (e) {
    return {
      body: String(e),
      status: 0,
      error: e.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_ERROR'
    };
  }
}

/**
 * Execute compliance check for a single project
 * @param {object} project - Project object from registry
 * @returns {Promise<object>} Compliance result
 */
export async function runProjectCompliance(project) {
  const startedAt = new Date();
  // Use timestamp with milliseconds to ensure uniqueness
  // Format: 2026-01-18T12-34-56-789
  const timestamp = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, -1);
  const evidenceDir = ensureEvidenceDir(project.projectId, timestamp);

  const checks = [];
  let overallStatus = 'pass';

  try {
    // Execute compliance based on type
    if (project.compliance.type === 'commands') {
      for (const cmd of (project.compliance.commands || []).slice(0, 3)) {
        const checkName = cmd.split(' ').slice(0, 2).join(' ');
        try {
          const result = executeCommand(cmd, 5000);
          const checkStatus = result.exitCode === 0 ? 'pass' : 'warn';

          if (checkStatus === 'warn') overallStatus = 'warn';

          // Write evidence files
          const stdoutPath = path.join(evidenceDir, `${checkName.replace(/\s+/g, '_')}_stdout.txt`);
          const stderrPath = path.join(evidenceDir, `${checkName.replace(/\s+/g, '_')}_stderr.txt`);

          fs.writeFileSync(stdoutPath, result.stdout.slice(0, EVIDENCE_MAX_SIZE), 'utf8');
          if (result.stderr) {
            fs.writeFileSync(stderrPath, result.stderr.slice(0, EVIDENCE_MAX_SIZE), 'utf8');
          }

          checks.push({
            name: checkName,
            status: checkStatus,
            reason: checkStatus === 'pass' ? 'Command succeeded' : `Exit code: ${result.exitCode}`,
            evidencePath: `compliance/${project.projectId}/${timestamp}`
          });
        } catch (e) {
          overallStatus = 'warn';
          checks.push({
            name: cmd.split(' ').slice(0, 2).join(' '),
            status: 'fail',
            reason: String(e),
            evidencePath: `compliance/${project.projectId}/${timestamp}`
          });
        }
      }
    } else if (project.compliance.type === 'url') {
      const checkName = 'url-check';
      const result = await fetchComplianceUrl(project.compliance.url, 10000);
      const checkStatus = result.error ? 'warn' : result.status === 200 ? 'pass' : 'warn';

      if (checkStatus === 'warn') overallStatus = 'warn';

      const resultPath = path.join(evidenceDir, 'url_response.txt');
      fs.writeFileSync(resultPath, result.body, 'utf8');

      checks.push({
        name: checkName,
        status: checkStatus,
        reason: result.error || `HTTP ${result.status}`,
        evidencePath: `compliance/${project.projectId}/${timestamp}`
      });
    }

    // Contract enforcer (PCONST + required events)
    const contractResult = runContractEnforcer(project, evidenceDir);
    checks.push(contractResult);
    if (contractResult.status === 'non_compliant') {
      overallStatus = 'non_compliant';
    } else if (contractResult.status === 'partial' && overallStatus === 'pass') {
      overallStatus = 'warn';
    }
  } catch (e) {
    overallStatus = 'fail';
    checks.push({
      name: 'system-error',
      status: 'fail',
      reason: String(e),
      evidencePath: `compliance/${project.projectId}/${timestamp}`
    });
  }

  const finishedAt = new Date();
  const durationMs = finishedAt - startedAt;

  // Write meta file
  const metaPath = path.join(evidenceDir, 'meta.json');
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        projectId: project.projectId,
        projectName: project.name,
        status: overallStatus,
        checksCount: checks.length,
        checksPassed: checks.filter(c => c.status === 'pass').length,
        checksWarned: checks.filter(c => c.status === 'warn').length,
        checksFailed: checks.filter(c => c.status === 'fail').length,
        checksNonCompliant: checks.filter(c => c.status === 'non_compliant').length,
        startedAt,
        finishedAt,
        durationMs,
        complianceType: project.compliance.type
      },
      null,
      2
    ),
    'utf8'
  );

  // Register artifact
  const files = {
    metaPath,
    resultsPath: path.join(evidenceDir, 'result.json'),
    contractPath: path.join(evidenceDir, 'contract_enforcer.json')
  };

  fs.writeFileSync(
    files.resultsPath,
    JSON.stringify({ checks }, null, 2),
    'utf8'
  );

  try {
    registerArtifact(
      project.projectId,
      `compliance-${timestamp}`,
      `compliance-check`,
      overallStatus === 'pass' ? 0 : 1,
      files
    );
  } catch (e) {
    console.error('Error registering artifact:', e);
  }

  return {
    projectId: project.projectId,
    projectName: project.name,
    status: overallStatus,
    checks,
    startedAt,
    finishedAt,
    durationMs,
    evidencePath: `compliance/${project.projectId}/${timestamp}`
  };
}

/**
 * Run compliance checks for one or all projects
 * @param {object} options - { projectId?: string, all?: boolean }
 * @returns {Promise<array>} Array of compliance results
 */
export async function runCompliance(options = {}) {
  const registry = loadRegistry();
  const projects = registry.projects || [];

  if (!projects.length) {
    return [{ error: 'No projects found in registry' }];
  }

  let projectsToRun = projects;

  if (options.projectId) {
    projectsToRun = projects.filter(p => p.projectId === options.projectId);
    if (!projectsToRun.length) {
      return [{ error: `Project ${options.projectId} not found` }];
    }
  }

  const results = [];
  const startTime = new Date().toISOString();
  for (const project of projectsToRun) {
    const result = await runProjectCompliance(project);
    results.push(result);
    
    // Emit platform event for active compliance completion
    try {
      const eventData = {
        type: 'compliance.active.completed',
        product_id: project.projectId,
        data: {
          product_id: project.projectId,
          run_id: `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          result: result.status,
          evidence_paths: result.evidencePath ? [result.evidencePath] : [],
          checks_summary: {
            total: result.checks ? result.checks.length : 0,
            passed: result.checks ? result.checks.filter(c => c.status === 'pass').length : 0,
            warned: result.checks ? result.checks.filter(c => c.status === 'warn').length : 0,
            failed: result.checks ? result.checks.filter(c => c.status === 'fail').length : 0
          },
          started_at: startTime,
          finished_at: new Date().toISOString()
        }
      };
      // Emit event if emitter is set up (provided by paid-platform)
      if (eventEmitter) {
        eventEmitter(eventData);
      }
    } catch (eventErr) {
      console.warn('[runCompliance] Failed to emit platform event:', eventErr.message);
      // Don't fail the compliance run if platform event fails
    }
  }

  return results;
}


/**
 * Get latest compliance status for a project
 * @param {string} projectId - Project ID
 * @returns {object|null} Latest compliance result or null
 */
export function getLatestComplianceStatus(projectId) {
  const registry = loadRegistry();
  const project = (registry.projects || []).find(p => p.projectId === projectId);

  if (!project) return null;

  const projectDir = path.join(COMPLIANCE_DIR, projectId);
  if (!fs.existsSync(projectDir)) {
    return {
      projectId,
      projectName: project.name,
      status: null,
      message: 'No compliance runs yet'
    };
  }

  try {
    const timestamps = fs.readdirSync(projectDir)
      .filter(name => fs.statSync(path.join(projectDir, name)).isDirectory())
      .sort()
      .reverse();

    if (!timestamps.length) return null;

    const latestDir = path.join(projectDir, timestamps[0]);
    const metaPath = path.join(latestDir, 'meta.json');
    const resultsPath = path.join(latestDir, 'result.json');

    if (!fs.existsSync(metaPath)) return null;

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath, 'utf8')) : {};

    return {
      projectId,
      projectName: project.name,
      status: meta.status,
      lastRunAt: meta.finishedAt,
      durationMs: meta.durationMs,
      checksCount: meta.checksCount,
      checksPassed: meta.checksPassed,
      checksWarned: meta.checksWarned,
      checksFailed: meta.checksFailed,
      checks: results.checks,
      evidencePath: `compliance/${projectId}/${timestamps[0]}`
    };
  } catch (e) {
    console.error('Error reading compliance status:', e);
    return null;
  }
}

/**
 * Get all projects from registry with latest compliance status
 * @returns {array} Array of projects with status
 */
export function getAllProjectsWithStatus() {
  const registry = loadRegistry();
  return (registry.projects || []).map(project => ({
    ...project,
    latestCompliance: getLatestComplianceStatus(project.projectId)
  }));
}
