/**
 * Enhanced Cloud Storage Query Engine
 * 
 * Provides advanced filtering and querying capabilities:
 * - Time-range filtering
 * - Event-type filtering
 * - Aggregation and statistical analysis
 * - Indexed queries for performance
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data/replay');

export class StorageQueryEngine {
  constructor(storageClient) {
    this.storage = storageClient;
    this.indexCache = new Map(); // session -> index
  }

  /**
   * Query events with advanced filtering
   * @param {string} projectId
   * @param {string} sessionId
   * @param {Object} filters - { types?, startTime?, endTime?, limit, offset }
   * @returns {Promise<Array>} Filtered events
   */
  async queryEvents(projectId, sessionId, filters = {}) {
    try {
      const sessionFile = path.join(DATA_DIR, 'projects', projectId, 'sessions', `${sessionId}.jsonl`);
      
      // Check if file exists
      try {
        await fs.access(sessionFile);
      } catch {
        return [];
      }

      const content = await fs.readFile(sessionFile, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim());
      
      let events = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(e => e !== null);

      // Apply filters
      events = this._applyFilters(events, filters);

      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 1000;
      const paginated = events.slice(offset, offset + limit);

      return paginated;
    } catch (err) {
      console.error(`[StorageQueryEngine] Query error: ${err.message}`);
      return [];
    }
  }

  /**
   * Get events by type
   */
  async getEventsByType(projectId, sessionId, eventTypes, filters = {}) {
    const events = await this.queryEvents(projectId, sessionId, {
      ...filters,
      types: eventTypes
    });
    return events;
  }

  /**
   * Get events in time range
   */
  async getEventsByTimeRange(projectId, sessionId, startTime, endTime, filters = {}) {
    const events = await this.queryEvents(projectId, sessionId, {
      ...filters,
      startTime,
      endTime
    });
    return events;
  }

  /**
   * Aggregate events (count, group by type, etc.)
   */
  async aggregateEvents(projectId, sessionId, groupBy = 'type') {
    try {
      const events = await this.queryEvents(projectId, sessionId, { limit: 10000 });
      
      const aggregated = {};
      for (const event of events) {
        const key = event[groupBy] || 'unknown';
        aggregated[key] = (aggregated[key] || 0) + 1;
      }

      return aggregated;
    } catch (err) {
      console.error(`[StorageQueryEngine] Aggregation error: ${err.message}`);
      return {};
    }
  }

  /**
   * Get event timeline (events with timestamps)
   */
  async getTimeline(projectId, sessionId, filters = {}) {
    const events = await this.queryEvents(projectId, sessionId, filters);
    
    return events
      .filter(e => e.timestamp || e.ts)
      .map(e => ({
        timestamp: e.timestamp || e.ts,
        type: e.type,
        id: e.id,
        data: e
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Get session statistics
   */
  async getSessionStats(projectId, sessionId) {
    try {
      const events = await this.queryEvents(projectId, sessionId, { limit: 10000 });
      
      if (events.length === 0) {
        return {
          eventCount: 0,
          timeRange: null,
          eventTypes: {},
          commandCount: 0,
          errorCount: 0
        };
      }

      const timestamps = events
        .map(e => e.timestamp || e.ts)
        .filter(t => t)
        .map(t => new Date(t).getTime())
        .sort((a, b) => a - b);

      const stats = {
        eventCount: events.length,
        timeRange: {
          start: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null,
          end: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null,
          duration: timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 0
        },
        eventTypes: {},
        commandCount: 0,
        errorCount: 0,
        averageEventInterval: 0
      };

      // Count event types
      for (const event of events) {
        const type = event.type || 'unknown';
        stats.eventTypes[type] = (stats.eventTypes[type] || 0) + 1;

        if (type === 'command_executed') stats.commandCount++;
        if (event.error || event.status === 'error' || type.includes('error')) stats.errorCount++;
      }

      // Calculate average interval
      if (timestamps.length > 1) {
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push(timestamps[i] - timestamps[i - 1]);
        }
        stats.averageEventInterval = Math.round(
          intervals.reduce((a, b) => a + b, 0) / intervals.length
        );
      }

      return stats;
    } catch (err) {
      console.error(`[StorageQueryEngine] Stats error: ${err.message}`);
      return null;
    }
  }

  /**
   * Search events by content
   */
  async searchEvents(projectId, sessionId, searchTerm, fields = ['type', 'command', 'output']) {
    const events = await this.queryEvents(projectId, sessionId, { limit: 10000 });
    const searchLower = searchTerm.toLowerCase();

    return events.filter(event => {
      for (const field of fields) {
        const value = event[field];
        if (value && String(value).toLowerCase().includes(searchLower)) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Apply filters to events array
   * @private
   */
  _applyFilters(events, filters) {
    let filtered = [...events];

    // Filter by type
    if (filters.types && Array.isArray(filters.types) && filters.types.length > 0) {
      filtered = filtered.filter(e => filters.types.includes(e.type));
    }

    // Filter by time range
    if (filters.startTime || filters.endTime) {
      const start = filters.startTime ? new Date(filters.startTime).getTime() : 0;
      const end = filters.endTime ? new Date(filters.endTime).getTime() : Date.now();

      filtered = filtered.filter(e => {
        const ts = (e.timestamp || e.ts) ? new Date(e.timestamp || e.ts).getTime() : 0;
        return ts >= start && ts <= end;
      });
    }

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter(e => e.status === filters.status);
    }

    // Filter by severity
    if (filters.severity) {
      const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
      filtered = filtered.filter(e => {
        const s = e.severity || e.evaluation?.severity;
        return s ? severities.includes(s) : false;
      });
    }

    // Sort by timestamp
    filtered.sort((a, b) => {
      const aTime = a.timestamp || a.ts ? new Date(a.timestamp || a.ts).getTime() : 0;
      const bTime = b.timestamp || b.ts ? new Date(b.timestamp || b.ts).getTime() : 0;
      return aTime - bTime;
    });

    return filtered;
  }

  /**
   * Query across multiple projects (and optionally sessions) with filters
   * @param {Object} filters - { projects?, sessionId?, types?, severity?, startTime?, endTime?, status?, limit?, offset? }
   * @returns {Promise<Array>} Combined filtered events
   */
  async queryAcrossProjects(filters = {}) {
    try {
      const baseDir = path.join(DATA_DIR, 'projects');
      const dirents = await fs.readdir(baseDir, { withFileTypes: true }).catch(() => []);
      const allProjects = dirents.filter(d => d.isDirectory()).map(d => d.name);

      const targetProjects = Array.isArray(filters.projects) && filters.projects.length
        ? filters.projects
        : allProjects;

      let combined = [];
      for (const projectId of targetProjects) {
        const sessionsDir = path.join(baseDir, projectId, 'sessions');
        const sessDirents = await fs.readdir(sessionsDir, { withFileTypes: true }).catch(() => []);
        const sessionFiles = sessDirents.filter(d => d.isFile() && d.name.endsWith('.jsonl')).map(d => d.name);

        for (const file of sessionFiles) {
          const sid = file.replace(/\.jsonl$/, '');
          if (filters.sessionId && sid !== filters.sessionId) continue;

          const events = await this.queryEvents(projectId, sid, filters);
          // Ensure projectId present
          for (const e of events) {
            if (!e.project) e.project = projectId;
          }
          combined.push(...events);
        }
      }

      // Global pagination over combined set
      const offset = filters.offset || 0;
      const limit = filters.limit || 1000;
      return combined.slice(offset, offset + limit);
    } catch (err) {
      console.error(`[StorageQueryEngine] Cross-project query error: ${err.message}`);
      return [];
    }
  }

  /**
   * Export events to various formats
   */
  async exportEvents(projectId, sessionId, format = 'json', filters = {}) {
    const events = await this.queryEvents(projectId, sessionId, { ...filters, limit: 10000 });

    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);

      case 'csv':
        return this._exportCSV(events);

      case 'jsonl':
        return events.map(e => JSON.stringify(e)).join('\n');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export events as CSV
   * @private
   */
  _exportCSV(events) {
    if (events.length === 0) return '';

    // Get all unique keys
    const keys = new Set();
    for (const event of events) {
      Object.keys(event).forEach(k => keys.add(k));
    }

    const headers = Array.from(keys);
    const rows = [headers.map(h => `"${h}"`).join(',')];

    for (const event of events) {
      const values = headers.map(h => {
        const val = event[h];
        const str = val === null || val === undefined ? '' : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      });
      rows.push(values.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.indexCache.clear();
  }
}

// Export singleton
let queryEngineInstance = null;

export function getStorageQueryEngine(storageClient) {
  if (!queryEngineInstance && storageClient) {
    queryEngineInstance = new StorageQueryEngine(storageClient);
  }
  return queryEngineInstance;
}

export function resetStorageQueryEngine() {
  queryEngineInstance = null;
}
