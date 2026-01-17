#!/usr/bin/env node
import { writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * Run Session Logger - records events to JSONL
 * 
 * Event types:
 * - RUN_STARTED / RUN_STOPPED
 * - TASK_STARTED / TASK_FINISHED
 * - COMMAND_PROPOSED / COMMAND_EXECUTED
 * - DANGER_REQUIRES_APPROVAL / DANGER_APPROVED
 * - COST_UPDATED
 * - TEST_RUN / DEPLOY_RUN
 */

let currentRunSessionId = null;
let currentProject = null;
let eventCallback = null;

export function setEventCallback(callback) {
  eventCallback = callback;
}

export function startRunSession(project) {
  currentRunSessionId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  currentProject = project;
  
  logEvent({
    type: 'RUN_STARTED',
    project,
    runSessionId: currentRunSessionId
  });
  
  return currentRunSessionId;
}

export function stopRunSession(project, reason = 'manual') {
  if (!currentRunSessionId) return null;
  
  logEvent({
    type: 'RUN_STOPPED',
    project,
    runSessionId: currentRunSessionId,
    reason
  });
  
  const sessionId = currentRunSessionId;
  currentRunSessionId = null;
  currentProject = null;
  return sessionId;
}

export function getCurrentRunSessionId() {
  return currentRunSessionId;
}

export function logEvent(event) {
  const ts = new Date().toISOString();
  const project = event.project || currentProject || 'unknown';
  const runSessionId = event.runSessionId || currentRunSessionId || 'no-session';
  
  const fullEvent = {
    ts,
    project,
    runSessionId,
    ...event
  };
  
  // Ensure runs directory exists
  const runsDir = join(process.cwd(), 'data', 'runs');
  if (!existsSync(runsDir)) {
    mkdirSync(runsDir, { recursive: true });
  }
  
  // Write to JSONL file
  const logPath = join(runsDir, `${project}.jsonl`);
  const line = JSON.stringify(fullEvent) + '\n';
  
  try {
    appendFileSync(logPath, line, 'utf8');
  } catch (err) {
    console.error('[runlog] Failed to write event:', err);
  }
  
  // Trigger callback if set (for WebSocket broadcast)
  if (eventCallback) {
    eventCallback(fullEvent);
  }
  
  return fullEvent;
}

export function getRunEvents(project, runSessionId) {
  const logPath = join(process.cwd(), 'data', 'runs', `${project}.jsonl`);
  
  if (!existsSync(logPath)) {
    return [];
  }
  
  try {
    const content = readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const events = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    if (runSessionId) {
      return events.filter(e => e.runSessionId === runSessionId);
    }
    
    return events;
  } catch (err) {
    console.error('[runlog] Failed to read events:', err);
    return [];
  }
}

export function getLatestRunSessionId(project) {
  const events = getRunEvents(project);
  if (events.length === 0) return null;
  
  const startEvents = events.filter(e => e.type === 'RUN_STARTED');
  if (startEvents.length === 0) return null;
  
  return startEvents[startEvents.length - 1].runSessionId;
}

export function listRunSessions(project, limit = 20) {
  const logPath = join(process.cwd(), 'data', 'runs', `${project}.jsonl`);
  
  if (!existsSync(logPath)) {
    return [];
  }
  
  try {
    const content = readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const events = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    // Group events by runSessionId
    const sessionMap = new Map();
    
    events.forEach(event => {
      const sid = event.runSessionId;
      if (!sid) return;
      
      if (!sessionMap.has(sid)) {
        sessionMap.set(sid, {
          runSessionId: sid,
          firstTs: event.ts,
          lastTs: event.ts,
          eventsCount: 0
        });
      }
      
      const session = sessionMap.get(sid);
      session.eventsCount++;
      
      // Update first/last timestamps
      if (event.ts < session.firstTs) session.firstTs = event.ts;
      if (event.ts > session.lastTs) session.lastTs = event.ts;
    });
    
    // Convert to array and sort by lastTs desc
    const sessions = Array.from(sessionMap.values())
      .sort((a, b) => new Date(b.lastTs) - new Date(a.lastTs))
      .slice(0, limit);
    
    return sessions;
  } catch (err) {
    console.error('[runlog] Failed to list sessions:', err);
    return [];
  }
}

export function truncateOutput(text, maxLength = 2000) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + `\n... (truncated ${text.length - maxLength} chars)`;
}
