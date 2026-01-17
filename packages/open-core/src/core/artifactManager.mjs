/**
 * Artifact Manager - cleanup, rotation, and index management for verify artifacts
 *
 * Features:
 * - Rotate artifacts by age and total size
 * - Maintain central artifact index JSON
 * - Query artifacts by runSessionId, project, timestamp
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const RUNS_DIR = path.resolve(process.cwd(), 'data', 'runs');
const INDEX_FILE = path.join(RUNS_DIR, 'artifact_index.json');

// Age-based rotation: remove artifacts older than this (30 days by default, configurable)
// Read at runtime to allow test overrides
function getMaxAgeMs() {
  return Number(process.env.ARTIFACT_MAX_AGE_MS || 30 * 24 * 60 * 60 * 1000);
}

// Size-based rotation: if total size exceeds this, delete oldest artifacts (500MB by default)
// Read at runtime to allow test overrides
function getMaxSizeBytes() {
  return Number(process.env.ARTIFACT_MAX_SIZE_BYTES || 500 * 1024 * 1024);
}

/**
 * Load artifact index from JSON file
 */
export function loadArtifactIndex() {
  try {
    if (!fs.existsSync(INDEX_FILE)) return { artifacts: [] };
    const data = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    return Array.isArray(data.artifacts) ? data : { artifacts: [] };
  } catch (e) {
    console.error('Error loading artifact index:', e);
    return { artifacts: [] };
  }
}

/**
 * Save artifact index to JSON file
 */
function saveArtifactIndex(index) {
  try {
    if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving artifact index:', e);
  }
}

/**
 * Register a new artifact in the index
 * @param {string} project - project ID
 * @param {string} runSessionId - run session ID
 * @param {string} cmd - command that was run
 * @param {number} exitCode - exit code
 * @param {object} files - { stdoutPath, stderrPath, metaPath, envPath, psPath, ... }
 */
export function registerArtifact(project, runSessionId, cmd, exitCode, files) {
  const index = loadArtifactIndex();
  const ts = new Date().toISOString();
  
  // Calculate total file size
  let totalSize = 0;
  try {
    for (const file of Object.values(files)) {
      if (file && fs.existsSync(file)) {
        totalSize += fs.statSync(file).size;
      }
    }
  } catch (e) {}

  const entry = {
    id: `artifact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    ts,
    project,
    runSessionId,
    cmd,
    exitCode,
    files,
    sizeBytes: totalSize
  };

  index.artifacts.push(entry);
  saveArtifactIndex(index);
  return entry;
}

/**
 * Cleanup artifacts based on age and total size
 */
export function cleanupArtifacts() {
  const index = loadArtifactIndex();
  const now = Date.now();
  const MAX_AGE_MS = getMaxAgeMs();
  const MAX_TOTAL_SIZE_BYTES = getMaxSizeBytes();
  let removed = 0;

  // First pass: remove old artifacts
  const beforeAge = index.artifacts.length;
  index.artifacts = index.artifacts.filter((entry) => {
    const age = now - new Date(entry.ts).getTime();
    const shouldRemove = age > MAX_AGE_MS;
    
    if (shouldRemove) {
      try {
        for (const file of Object.values(entry.files || {})) {
          if (file && fs.existsSync(file)) {
            fs.unlinkSync(file);
            removed++;
          }
        }
      } catch (e) {
        console.error('Error deleting artifact file:', e);
      }
    }
    
    return !shouldRemove;
  });

  // Second pass: if total size exceeds limit, delete oldest
  let totalSize = index.artifacts.reduce((sum, a) => sum + (a.sizeBytes || 0), 0);
  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    // Sort by timestamp, oldest first
    index.artifacts.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    
    while (index.artifacts.length > 0 && totalSize > MAX_TOTAL_SIZE_BYTES) {
      const entry = index.artifacts.shift();
      totalSize -= (entry.sizeBytes || 0);
      
      try {
        for (const file of Object.values(entry.files || {})) {
          if (file && fs.existsSync(file)) {
            fs.unlinkSync(file);
            removed++;
          }
        }
      } catch (e) {}
    }
  }

  if (removed > 0) {
    saveArtifactIndex(index);
    console.log(`[artifactManager] cleaned up ${removed} artifact files`);
  }

  return { removed, indexEntriesRemoved: beforeAge - index.artifacts.length };
}

/**
 * Get artifacts for a specific run session
 */
export function getArtifactsForSession(project, runSessionId) {
  const index = loadArtifactIndex();
  return index.artifacts.filter(a => a.project === project && a.runSessionId === runSessionId);
}

/**
 * Get all artifacts for a project
 */
export function getArtifactsForProject(project) {
  const index = loadArtifactIndex();
  return index.artifacts.filter(a => a.project === project);
}

/**
 * Cleanup empty project directories
 */
export function cleanupEmptyProjectDirs() {
  try {
    const dirs = fs.readdirSync(RUNS_DIR, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory() || d.name === 'artifact_index.json') continue;
      const projDir = path.join(RUNS_DIR, d.name);
      const files = fs.readdirSync(projDir);
      if (files.length === 0) {
        fs.rmdirSync(projDir);
      }
    }
  } catch (e) {
    // ignore
  }
}
