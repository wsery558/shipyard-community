/**
 * Test Data Seeder for Report Validation
 * Creates deterministic test session + events in data/replay for API testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../');

export async function seedTestData(projectId = 'test-project', sessionId = 'test-session-seed') {
  const replayDir = path.join(ROOT_DIR, 'data/replay/projects', projectId, 'sessions');
  const sessionFile = path.join(replayDir, `${sessionId}.jsonl`);
  
  // Create directory structure
  fs.mkdirSync(replayDir, { recursive: true });
  
  // Clear any existing session file
  if (fs.existsSync(sessionFile)) {
    fs.unlinkSync(sessionFile);
  }
  
  // Create deterministic test events
  const now = new Date('2025-01-15T10:00:00Z');
  const events = [
    {
      type: 'session_start',
      timestamp: now.getTime(),
      projectId,
      sessionId,
      metadata: { env: 'test', mode: 'smoke' }
    },
    {
      type: 'task_start',
      timestamp: new Date(now.getTime() + 1000).getTime(),
      taskId: 'task-1',
      taskName: 'Create API endpoint',
      status: 'running'
    },
    {
      type: 'command_executed',
      timestamp: new Date(now.getTime() + 2000).getTime(),
      command: 'npm test',
      status: 'success',
      duration: 5000,
      output: 'All tests passed'
    },
    {
      type: 'task_completed',
      timestamp: new Date(now.getTime() + 8000).getTime(),
      taskId: 'task-1',
      status: 'success',
      result: { linesAdded: 145, filesModified: 2 }
    },
    {
      type: 'task_start',
      timestamp: new Date(now.getTime() + 9000).getTime(),
      taskId: 'task-2',
      taskName: 'Write tests',
      status: 'running'
    },
    {
      type: 'command_executed',
      timestamp: new Date(now.getTime() + 10000).getTime(),
      command: 'npm test',
      status: 'success',
      duration: 3000,
      output: 'Test coverage: 92%'
    },
    {
      type: 'task_completed',
      timestamp: new Date(now.getTime() + 14000).getTime(),
      taskId: 'task-2',
      status: 'success',
      result: { testCount: 24, coverage: 0.92 }
    },
    {
      type: 'session_completed',
      timestamp: new Date(now.getTime() + 15000).getTime(),
      projectId,
      sessionId,
      status: 'success',
      stats: { tasksCompleted: 2, eventsCount: 8, duration: 15000 }
    }
  ];
  
  // Write events as JSONL
  const jsonlContent = events.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(sessionFile, jsonlContent);
  
  return {
    projectId,
    sessionId,
    replayDir,
    sessionFile,
    eventCount: events.length,
    timeRange: {
      start: now.toISOString(),
      end: new Date(now.getTime() + 15000).toISOString(),
      durationMs: 15000
    }
  };
}

export function cleanupTestData(projectId = 'test-project') {
  const projectDir = path.join(ROOT_DIR, 'data/replay/projects', projectId);
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

export async function getTestDataInfo(projectId = 'test-project', sessionId = 'test-session-seed') {
  const replayDir = path.join(ROOT_DIR, 'data/replay/projects', projectId, 'sessions');
  const sessionFile = path.join(replayDir, `${sessionId}.jsonl`);
  
  if (!fs.existsSync(sessionFile)) {
    return null;
  }
  
  const content = fs.readFileSync(sessionFile, 'utf-8');
  const events = content.trim().split('\n').map(line => JSON.parse(line));
  
  return {
    projectId,
    sessionId,
    eventCount: events.length,
    events,
    firstEvent: events[0],
    lastEvent: events[events.length - 1]
  };
}
