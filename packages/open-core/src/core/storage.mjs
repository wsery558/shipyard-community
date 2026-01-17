/**
 * Storage Pipeline for Cloud Replay
 * 
 * Handles S3/Minio storage of execution events, commands, outputs, and reports.
 * Events are stored as JSONL files (one JSON object per line) organized by project/session.
 * 
 * Format:
 * s3://bucket/replay/
 *   ├── projects/
 *   │   ├── {projectId}/
 *   │   │   ├── sessions/
 *   │   │   │   ├── {sessionId}.jsonl
 *   │   │   │   └── {sessionId}.summary.json
 *   │   │   └── reports/
 *   │   │       ├── {sessionId}.json
 *   │   │       ├── {sessionId}.csv
 *   │   │       ├── {sessionId}.html
 *   │   │       └── {sessionId}.pdf
 *   └── uploads/
 *       └── {timestamp}.log (bulk logs)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data/replay');

// Ensure data directory exists
const ensureDir = async (dir) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
};

/**
 * Local file-based storage (development/fallback)
 * In production, replace with AWS SDK or MinIO client
 */
export class StorageClient {
  constructor(config = {}) {
    this.config = config;
    this.type = config.type || 'local'; // 'local', 's3', 'minio'
    this.bucket = config.bucket || 'agent-dashboard';
    this.region = config.region || 'us-east-1';
    this.endpoint = config.endpoint; // For MinIO
    this.enabled = config.enabled !== false;
  }

  /**
   * Initialize storage client
   */
  async initialize() {
    if (this.type === 'local') {
      await ensureDir(DATA_DIR);
      console.log(`[Storage] Using local storage at ${DATA_DIR}`);
    } else if (this.type === 's3' || this.type === 'minio') {
      // TODO: Initialize S3/MinIO client
      console.log(`[Storage] Using ${this.type} at ${this.endpoint}`);
    }
  }

  /**
   * Store a single event in JSONL format
   * @param {string} projectId - Project identifier
   * @param {string} sessionId - Session identifier
   * @param {object} event - Event object to store
   * @returns {Promise<void>}
   */
  async storeEvent(projectId, sessionId, event) {
    if (!this.enabled) return;

    try {
      const eventWithMeta = {
        ...event,
        ts: event.ts || new Date().toISOString(),
        projectId,
        sessionId
      };

      const sessionDir = path.join(DATA_DIR, 'projects', projectId, 'sessions');
      await ensureDir(sessionDir);
      
      const sessionFile = path.join(sessionDir, `${sessionId}.jsonl`);
      const line = JSON.stringify(eventWithMeta) + '\n';
      
      await fs.appendFile(sessionFile, line, 'utf-8');
    } catch (e) {
      console.error(`[Storage] Error storing event: ${e.message}`);
    }
  }

  /**
   * Store batch of events (for bulk operations)
   * @param {string} projectId - Project identifier
   * @param {string} sessionId - Session identifier
   * @param {array} events - Array of event objects
   * @returns {Promise<void>}
   */
  async storeEvents(projectId, sessionId, events) {
    if (!this.enabled) return;

    try {
      const sessionDir = path.join(DATA_DIR, 'projects', projectId, 'sessions');
      await ensureDir(sessionDir);
      
      const sessionFile = path.join(sessionDir, `${sessionId}.jsonl`);
      const lines = events
        .map(event => JSON.stringify({
          ...event,
          ts: event.ts || new Date().toISOString(),
          projectId,
          sessionId
        }))
        .join('\n');
      
      if (lines) {
        await fs.appendFile(sessionFile, lines + '\n', 'utf-8');
      }
    } catch (e) {
      console.error(`[Storage] Error storing events: ${e.message}`);
    }
  }

  /**
   * Retrieve all events for a session (with optional filtering)
   * @param {string} projectId - Project identifier
   * @param {string} sessionId - Session identifier
   * @param {object} filter - Filter options (startTs, endTs, eventType)
   * @returns {Promise<array>} Array of events
   */
  async getEvents(projectId, sessionId, filter = {}) {
    if (!this.enabled) return [];

    try {
      const sessionFile = path.join(DATA_DIR, 'projects', projectId, 'sessions', `${sessionId}.jsonl`);
      
      try {
        const content = await fs.readFile(sessionFile, 'utf-8');
        const events = content
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        // Apply filters
        if (filter.startTs) {
          const startTime = new Date(filter.startTs).getTime();
          return events.filter(e => new Date(e.ts).getTime() >= startTime);
        }
        if (filter.endTs) {
          const endTime = new Date(filter.endTs).getTime();
          return events.filter(e => new Date(e.ts).getTime() <= endTime);
        }
        if (filter.eventType) {
          return events.filter(e => e.type === filter.eventType);
        }

        return events;
      } catch (e) {
        // File doesn't exist yet
        return [];
      }
    } catch (e) {
      console.error(`[Storage] Error retrieving events: ${e.message}`);
      return [];
    }
  }

  /**
   * Get session summary (metadata about the session)
   * @param {string} projectId - Project identifier
   * @param {string} sessionId - Session identifier
   * @returns {Promise<object>} Session summary
   */
  async getSessionSummary(projectId, sessionId) {
    if (!this.enabled) return null;

    try {
      const summaryFile = path.join(
        DATA_DIR,
        'projects',
        projectId,
        'sessions',
        `${sessionId}.summary.json`
      );

      try {
        const content = await fs.readFile(summaryFile, 'utf-8');
        return JSON.parse(content);
      } catch {
        // Generate summary from events if file doesn't exist
        const events = await this.getEvents(projectId, sessionId);
        if (events.length === 0) return null;

        const summary = {
          sessionId,
          projectId,
          startTime: events[0]?.ts,
          endTime: events[events.length - 1]?.ts,
          eventCount: events.length,
          commandCount: events.filter(e => e.type === 'cmd:exec').length,
          approvalCount: events.filter(e => e.type === 'DANGER_APPROVED' || e.type === 'DANGER_REJECTED').length,
          errorCount: events.filter(e => e.type === 'cmd:error' || e.error).length,
          taskCount: events.filter(e => e.type === 'task:done').length
        };

        // Cache the summary
        await this.storeSummary(projectId, sessionId, summary);
        return summary;
      }
    } catch (e) {
      console.error(`[Storage] Error getting session summary: ${e.message}`);
      return null;
    }
  }

  /**
   * Store session summary metadata
   * @param {string} projectId - Project identifier
   * @param {string} sessionId - Session identifier
   * @param {object} summary - Summary object
   * @returns {Promise<void>}
   */
  async storeSummary(projectId, sessionId, summary) {
    if (!this.enabled) return;

    try {
      const sessionDir = path.join(DATA_DIR, 'projects', projectId, 'sessions');
      await ensureDir(sessionDir);
      
      const summaryFile = path.join(sessionDir, `${sessionId}.summary.json`);
      await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[Storage] Error storing summary: ${e.message}`);
    }
  }

  /**
   * Store a report file
   * @param {string} projectId - Project identifier
   * @param {string} sessionId - Session identifier
   * @param {string} format - Report format ('json', 'csv', 'html', 'pdf')
   * @param {string} content - Report content
   * @returns {Promise<string>} File path/URL
   */
  async storeReport(projectId, sessionId, format, content) {
    if (!this.enabled) return null;

    try {
      const reportDir = path.join(DATA_DIR, 'projects', projectId, 'reports');
      await ensureDir(reportDir);
      
      const filename = `${sessionId}.${format}`;
      const filepath = path.join(reportDir, filename);
      
      if (format === 'pdf') {
        // PDF is binary
        await fs.writeFile(filepath, content);
      } else {
        // JSON, CSV, HTML are text
        await fs.writeFile(filepath, content, 'utf-8');
      }

      return filepath;
    } catch (e) {
      console.error(`[Storage] Error storing report: ${e.message}`);
      return null;
    }
  }

  /**
   * Retrieve a report file
   * @param {string} projectId - Project identifier
   * @param {string} sessionId - Session identifier
   * @param {string} format - Report format
   * @returns {Promise<Buffer|string|null>}
   */
  async getReport(projectId, sessionId, format) {
    if (!this.enabled) return null;

    try {
      const filepath = path.join(
        DATA_DIR,
        'projects',
        projectId,
        'reports',
        `${sessionId}.${format}`
      );

      if (format === 'pdf') {
        return await fs.readFile(filepath);
      } else {
        return await fs.readFile(filepath, 'utf-8');
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error(`[Storage] Error retrieving report: ${e.message}`);
      }
      return null;
    }
  }

  /**
   * List all sessions for a project
   * @param {string} projectId - Project identifier
   * @returns {Promise<array>} Array of session IDs
   */
  async listSessions(projectId) {
    if (!this.enabled) return [];

    try {
      const sessionDir = path.join(DATA_DIR, 'projects', projectId, 'sessions');
      await ensureDir(sessionDir);
      
      const files = await fs.readdir(sessionDir);
      const sessions = new Set();
      
      files.forEach(file => {
        if (file.endsWith('.jsonl')) {
          const sessionId = file.replace('.jsonl', '');
          sessions.add(sessionId);
        }
      });

      return Array.from(sessions).sort().reverse();
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error(`[Storage] Error listing sessions: ${e.message}`);
      }
      return [];
    }
  }

  /**
   * Delete a session (cleanup)
   * @param {string} projectId - Project identifier
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>}
   */
  async deleteSession(projectId, sessionId) {
    if (!this.enabled) return false;

    try {
      const sessionDir = path.join(DATA_DIR, 'projects', projectId, 'sessions');
      const sessionFile = path.join(sessionDir, `${sessionId}.jsonl`);
      const summaryFile = path.join(sessionDir, `${sessionId}.summary.json`);
      
      await Promise.all([
        fs.unlink(sessionFile).catch(() => {}),
        fs.unlink(summaryFile).catch(() => {})
      ]);

      return true;
    } catch (e) {
      console.error(`[Storage] Error deleting session: ${e.message}`);
      return false;
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<object>} Storage stats (size, file count, etc)
   */
  async getStats() {
    if (!this.enabled) return null;

    try {
      const stats = {
        type: this.type,
        bucket: this.bucket,
        dataDir: DATA_DIR,
        totalSize: 0,
        fileCount: 0,
        projectCount: 0,
        sessionCount: 0
      };

      // Calculate directory size recursively
      const calculateSize = async (dir) => {
        let size = 0;
        let count = 0;
        try {
          const files = await fs.readdir(dir, { withFileTypes: true });
          for (const file of files) {
            if (file.isDirectory()) {
              const subStats = await calculateSize(path.join(dir, file.name));
              size += subStats.size;
              count += subStats.count;
            } else {
              const fileStat = await fs.stat(path.join(dir, file.name));
              size += fileStat.size;
              count++;
            }
          }
        } catch {}
        return { size, count };
      };

      try {
        const dirStats = await calculateSize(DATA_DIR);
        stats.totalSize = dirStats.size;
        stats.fileCount = dirStats.count;

        // Count projects and sessions
        const projectDir = path.join(DATA_DIR, 'projects');
        try {
          const projects = await fs.readdir(projectDir);
          stats.projectCount = projects.length;

          for (const project of projects) {
            const sessionDir = path.join(projectDir, project, 'sessions');
            try {
              const sessions = await fs.readdir(sessionDir);
              stats.sessionCount += sessions.filter(f => f.endsWith('.jsonl')).length;
            } catch {}
          }
        } catch {}
      } catch {}

      return stats;
    } catch (e) {
      console.error(`[Storage] Error calculating stats: ${e.message}`);
      return null;
    }
  }
}

// Default storage instance
let defaultClient = null;

/**
 * Initialize default storage client
 * @param {object} config - Configuration object
 * @returns {Promise<StorageClient>}
 */
export async function initializeStorage(config = {}) {
  defaultClient = new StorageClient(config);
  await defaultClient.initialize();
  return defaultClient;
}

/**
 * Get default storage client
 * @returns {StorageClient}
 */
export function getStorageClient() {
  if (!defaultClient) {
    defaultClient = new StorageClient();
  }
  return defaultClient;
}

export default {
  StorageClient,
  initializeStorage,
  getStorageClient
};
