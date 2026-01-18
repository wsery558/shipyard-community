// __SUPPRESS_EADDRINUSE_V4_1__
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import OpenAI from 'openai';

/* __OPENAI_OPTIONAL_V1__ */
// Open Core: OpenAI is OPTIONAL. Server must boot without OPENAI_API_KEY.
let openai = null;

function getOpenAI() {
  if (openai) return openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    openai = new OpenAI({ apiKey: key });
    return openai;
  } catch (e) {
    console.warn("[open-core] OpenAI disabled:", e?.message || e);
    return null;
  }
}

function requireOpenAI(res) {
  const c = getOpenAI();
  if (!c) {
    res.status(501).json({
      ok: false,
      error: "OPENAI_DISABLED",
      message: "This feature requires OPENAI_API_KEY. Open Core defaults to offline mode."
    });
    return null;
  }
  return c;
}

// Open Core imports (local orchestrator)
import { isDangerousBash } from './src/core/safety.mjs';
import { checkBudgetExceeded as checkBudgetCore } from './src/core/budget.mjs';
import { mergePlans, computeProgress } from './src/core/plan.mjs';
import { startRunSession, stopRunSession, getCurrentRunSessionId, logEvent as logEventCore, getRunEvents, getLatestRunSessionId, listRunSessions, truncateOutput } from './src/core/runlog.mjs';
import { buildMarkdownReport } from './src/core/report.mjs';
import { getStorageClient, initializeStorage } from './src/core/storage.mjs';
import { once } from 'node:events';
import { CommandHeartbeat } from './src/core/heartbeat.mjs';
import { getStallWatchdog } from './src/core/stallWatchdog.mjs';
import { detectVerifyCmds, runVerification } from './src/core/autoVerify.mjs';
import { createContextSnapshot } from './src/core/contextPack.mjs';
import { buildSummary, buildOfflineSummary } from './src/core/summary.mjs';
import { cleanupArtifacts } from './src/core/artifactManager.mjs';
import { getQueueManager } from './src/core/projectQueue.mjs';
import { getPolicyEngine } from './src/core/policyEngine.mjs';
import { getStorageQueryEngine } from './src/core/storageQueryEngine.mjs';
import { runCompliance, getLatestComplianceStatus, getAllProjectsWithStatus, setEventCallbacks } from './src/core/complianceRunner.mjs';

// Paid Platform imports (cloud/services SSOT)
import {
  loadUsers,
  getUserById,
  getUserEntitlements,
  grantEntitlement,
  revokeEntitlement,
  appendEvent,
  loadEvents,
  calculateMetrics,
  getPassiveComplianceStatus as getPlatformPassiveComplianceStatus,
  getAllProductsComplianceStatus
} from './src/core/platformCore.mjs';
import { getPassiveComplianceStatus } from './src/core/compliancePassive.mjs';

// Wire up event callbacks for open-core compliance runner
setEventCallbacks(appendEvent, loadEvents);


// -----------------------------
// Helpers
// -----------------------------
function safeJsonParse(maybeText) {
  if (!maybeText) return null;
  const t = String(maybeText).trim();
  // Try direct JSON
  try { return JSON.parse(t); } catch {}
  // Try to extract the first {...} block
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  if (i >= 0 && j > i) {
    try { return JSON.parse(t.slice(i, j + 1)); } catch {}
  }
  return null;
}

function getOutputText(resp) {
  // OpenAI Responses SDK usually provides output_text
  if (resp && typeof resp.output_text === 'string' && resp.output_text.trim()) return resp.output_text;
  // Fallback: scan resp.output content blocks
  const out = resp?.output;
  if (Array.isArray(out)) {
    let buf = "";
    for (const item of out) {
      const cs = item?.content;
      if (Array.isArray(cs)) {
        for (const c of cs) {
          if (typeof c?.text === "string") buf += c.text;
          if (typeof c?.output_text === "string") buf += c.output_text;
        }
      }
    }
    if (buf.trim()) return buf;
  }
  return "";
}
const PM_SYSTEM_PROMPT = `
You are a precise PM agent. Respond with ONLY a single JSON object; no markdown, no code fences.

Required schema:
{"state":{"total":number,"current":string,"currentPct":number,"project":string},"summary":string}

Rules:
- Be concise and realistic. total/currentPct must be 0-100.
- Keep summary to one short sentence.
`.trim();
const PM_PLAN_PROMPT = `
You are a PM assistant. Given project requirements, produce a plan as a single JSON object (no markdown).

Required schema:
{
  "project": string,
  "requirements": string,
  "tasks": [
    { "id"?: string, "title": string, "points": number, "status"?: "todo"|"doing"|"done"|"blocked", "verify": string[], "notes"?: string }
  ]
}

Rules:
- Preserve clarity: titles concise. Use status 'todo' for new tasks. IDs optional.
`.trim();

const PM_VERIFY_PROMPT = `
You are a PM reviewer. Respond ONLY with a JSON object with the following schema:
{ "done": boolean, "blocked": boolean, "notes": string, "updates"?: { "title"?: string, "points"?: number } }

Use the provided logs and task info to decide if the task is complete. No prose.
`.trim();
const ENGINEER_SYSTEM_PROMPT = `
You are a careful engineer. Respond with ONLY a single JSON object; no markdown, no code fences.

Required schema:
{"bash":string,"patch":string,"summary":string}

Rules:
- bash may be empty if not needed. patch may be empty.
- Prefer safe, reversible commands when possible.
- Do not explain; summary must be short.
`.trim();
const PORT = process.env.PORT || 8788;
const USD_TO_TWD = Number(process.env.USD_TO_TWD || 32);

const ENGINEER_MODEL = process.env.ENGINEER_MODEL || 'gpt-5.1-codex-mini';
const PM_MODEL = process.env.PM_MODEL || 'gpt-5-mini';
const ALLOW_DESTRUCTIVE = process.env.ALLOW_DESTRUCTIVE === '1';

// Smoke test mode: deterministic, no OpenAI calls
function isSmoke() {
  return process.env.WS_SMOKE === '1';
}

const hasKey = !!process.env.OPENAI_API_KEY;
if (isSmoke()) {
  console.log('WS_SMOKE mode: using deterministic stubs (no OpenAI)');
} else {
  console.log('OPENAI_API_KEY:', hasKey ? 'has_key' : 'missing');
}

const client = isSmoke() ? null : getOpenAI();

// -----------------------------
// Projects
// -----------------------------
const DATA_DIR = path.resolve('./data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const USAGE_DIR = path.join(DATA_DIR, 'usage');
fs.mkdirSync(USAGE_DIR, { recursive: true });
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PLANS_DIR = path.join(DATA_DIR, 'plans');
const COST_FILE = path.join(DATA_DIR, 'cost.json');
fs.mkdirSync(PLANS_DIR, { recursive: true });
// runtime maps
const pendingApprovals = new Map(); // project -> { project, taskId, bash, dangerReason }
const projectProcessing = new Set(); // per-project in-flight guard
const projectTerm = new Map(); // project -> term (PTY) (latest attached)
const commandHeartbeats = new Map(); // project -> CommandHeartbeat instance
const sessionSummaries = new Map(); // project -> { summaryText, updatedAt }
const engineerContexts = new Map(); // project -> conversation context buffer
let eventCountSinceLastSummary = 0;
const SUMMARY_TRIGGER_INTERVAL = 25; // Refresh summary every 25 events
const GLOBAL_CONCURRENCY = Number(process.env.GLOBAL_CONCURRENCY || 5);
let globalInFlight = 0;

function loadProjects() {
  try {
    const arr = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    const map = new Map(arr.map(p => [p.id, p]));
    return { list: arr, map };
  } catch (e) {
    console.error('Failed to load data/projects.json', e);
    return { list: [{ id: 'default', cwd: process.env.HOME }], map: new Map([['default',{id:'default',cwd:process.env.HOME}]]) };
  }
}
const PROJECTS = loadProjects();

// V4.2: Helper to check if we should auto-trigger summary (every 25 events)
function maybeAutoTriggerSummary(project) {
  eventCountSinceLastSummary++;
  
  if (eventCountSinceLastSummary >= SUMMARY_TRIGGER_INTERVAL) {
    eventCountSinceLastSummary = 0;
    // Async, don't wait - will be defined later with other helpers
    if (typeof triggerSummaryUpdate === 'function') {
      triggerSummaryUpdate(project).catch(err => {
        console.error('maybeAutoTriggerSummary error:', err);
      });
    }
  }
}

// V4.2: Wrapped logEvent to trigger auto-summary
// V4.5: Also store events in cloud replay storage
function logEvent(eventData) {
  logEventCore(eventData);
  
  // Store in cloud storage for replay (async, don't wait)
  const { project, sessionId } = eventData;
  if (project && sessionId) {
    const storage = getStorageClient();
    storage.storeEvent(project, sessionId, eventData).catch(e => {
      console.error('[logEvent] Failed to store event in cloud:', e.message);
    });
  }
  
  // Trigger auto-summary check
  if (eventData.project) {
    maybeAutoTriggerSummary(eventData.project);
  }
}

function usagePath(projectId) {
  return path.join(USAGE_DIR, `${projectId}.json`);
}

function loadUsage(projectId) {
  const p = usagePath(projectId);
  if (!fs.existsSync(p)) {
    return { projectId, totals: {}, updatedAt: null };
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { projectId, totals: {}, updatedAt: null };
  }
}

function loadPlan(projectId) {
  const p = path.join(PLANS_DIR, `${projectId}.json`);
  if (!fs.existsSync(p)) return { projectId, tasks: [] };
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { projectId, tasks: [] }; }
}

function savePlan(projectId, planObj) {
  const p = path.join(PLANS_DIR, `${projectId}.json`);
  fs.writeFileSync(p, JSON.stringify(planObj, null, 2));
}

function loadCost() {
  if (!fs.existsSync(COST_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(COST_FILE, 'utf8')); } catch { return {}; }
}

function saveCost(costObj) { fs.writeFileSync(COST_FILE, JSON.stringify(costObj, null, 2)); }

function addCost(projectId, model, usage) {
  const costs = loadCost();
  costs[projectId] ||= { models: {}, total: { input_tokens: 0, output_tokens: 0, total_tokens: 0, calls: 0, estimated_usd: 0, estimated_twd: 0 } };
  const store = costs[projectId];
  store.models[model] ||= { input_tokens: 0, output_tokens: 0, total_tokens: 0, calls: 0 };
  const m = store.models[model];
  const input = usage.input_tokens || 0; const output = usage.output_tokens || 0; const total = usage.total_tokens || (input + output);
  
  // Calculate cost
  const PRICES = {
    'gpt-5-mini': { in: 0.25, out: 2.00 },
    'gpt-5.1-codex-mini': { in: 0.25, out: 2.00 },
  };
  const rate = PRICES[model] || PRICES['gpt-5-mini'];
  const costUsd = (input / 1e6) * rate.in + (output / 1e6) * rate.out;
  const costTwd = costUsd * USD_TO_TWD;
  
  m.input_tokens += input; m.output_tokens += output; m.total_tokens += total; m.calls = (m.calls || 0) + 1;
  store.total.input_tokens += input; store.total.output_tokens += output; store.total.total_tokens += total;
  store.total.calls = (store.total.calls || 0) + 1;
  store.total.estimated_usd = (store.total.estimated_usd || 0) + costUsd;
  store.total.estimated_twd = (store.total.estimated_twd || 0) + costTwd;
  
  saveCost(costs);
  
  // Log cost update event
  logEvent({
    type: 'COST_UPDATED',
    project: projectId,
    calls: store.total.calls,
    tokens: store.total.total_tokens,
    twd: store.total.estimated_twd
  });
  
  return costs[projectId];
}

function checkBudgetExceeded(projectId) {
  const state = loadState();
  const budget = Number(state.budget) || 0;
  
  const costs = loadCost();
  const projectCost = costs[projectId] || {};
  const spent = projectCost.total?.estimated_twd || 0;
  
  return checkBudgetCore(spent, budget);
}

function saveUsage(projectId, usageObj) {
  const p = usagePath(projectId);
  fs.writeFileSync(p, JSON.stringify(usageObj, null, 2));
}

function addUsage(projectId, model, usage) {
  // usage: { input_tokens, output_tokens, total_tokens }
  const store = loadUsage(projectId);
  store.totals[model] ||= { input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0 };

  const input = usage?.input_tokens || 0;
  const output = usage?.output_tokens || 0;
  const total = usage?.total_tokens || (input + output);

  // Standard tier pricing (你貼的表)
  const PRICES = {
    'gpt-5-mini': { in: 0.25, out: 2.00 },            // per 1M tokens
    'gpt-5.1-codex-mini': { in: 0.25, out: 2.00 },
    // fallback 可以再加
  };
  const rate = PRICES[model] || PRICES['gpt-5-mini'];

  const costUsd = (input / 1e6) * rate.in + (output / 1e6) * rate.out;
  const costTwd = costUsd * USD_TO_TWD;

  const t = store.totals[model];
  t.input_tokens += input;
  t.output_tokens += output;
  t.total_tokens += total;
  t.cost_usd += costUsd;
  t.cost_twd += costTwd;

  store.updatedAt = new Date().toISOString();
  saveUsage(projectId, store);
  return store;
}

function summarizeUsage(projectId) {
  const store = loadUsage(projectId);
  let cost_usd = 0, cost_twd = 0, input_tokens = 0, output_tokens = 0, total_tokens = 0;

  for (const m of Object.keys(store.totals || {})) {
    const t = store.totals[m];
    cost_usd += t.cost_usd || 0;
    cost_twd += t.cost_twd || 0;
    input_tokens += t.input_tokens || 0;
    output_tokens += t.output_tokens || 0;
    total_tokens += t.total_tokens || 0;
  }

  return { projectId, cost_usd, cost_twd, input_tokens, output_tokens, total_tokens, updatedAt: store.updatedAt };
}

// -----------------------------
// Terminal sessions (per connection)
// -----------------------------
function createTerm(projectId) {
  const proj = PROJECTS.map.get(projectId) || PROJECTS.list[0];
  const shell = process.env.SHELL || 'bash';
  // In test mode, allow a fake PTY implementation via FAKE_PTY=1
  if (process.env.FAKE_PTY === '1') {
    // Minimal mock term with onData, write, kill
    const listeners = new Set();
    let currentTimer = null;
    const term = {
      write(data) {
        const s = String(data || '');
        // handle Ctrl-C
        if (s.includes('\x03')) {
          // simulate interrupt
          if (currentTimer) clearTimeout(currentTimer);
          for (const cb of listeners) cb('^C\r\n(simulated interrupted)\r\n');
          return;
        }

        // If data contains a sleep command, simulate long-running output
        if (/sleep\s+\d+/.test(s)) {
          // emit initial prompt/output
          currentTimer = setTimeout(() => {
            for (const cb of listeners) cb('\r\n(simulated long-running)\r\n');
          }, 200);
          // simulate completion after longer delay
          currentTimer = setTimeout(() => {
            for (const cb of listeners) cb('DONE\r\n');
          }, 4000);
        } else {
          for (const cb of listeners) cb(s);
        }
      },
      onData(cb) {
        listeners.add(cb);
        return { dispose() { listeners.delete(cb); } };
      },
      kill() {
        if (currentTimer) clearTimeout(currentTimer);
        for (const cb of listeners) cb('(killed)\r\n');
      }
    };
    return term;
  }

  return pty.spawn(shell, [], {
    cols: 120,
    rows: 30,
    cwd: proj?.cwd || process.env.HOME,
    env: process.env,
  });
}

async function processNextTask(project) {
  if (projectProcessing.has(project)) return; // per-project limit = 1
  if (globalInFlight >= GLOBAL_CONCURRENCY) {
    setTimeout(() => processNextTask(project), 300);
    return;
  }
  projectProcessing.add(project);
  globalInFlight++;
  try {
    const plan = loadPlan(project);
    const todo = (plan.tasks || []).find(t => !t.status || t.status === 'todo');
    if (!todo) return;

    // mark doing
    todo.status = 'doing';
    savePlan(project, plan);
    wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });

    // check for candidate bash in task fields before asking engineer
    const candidate = getTaskCandidateBash(todo);
    if (candidate) {
      const danger = isDangerousBash(candidate, project);
      logEvent({ type: 'POLICY_EVALUATED', project, action: danger.action || (danger.danger ? 'approval' : 'allow'), code: danger.code, reason: danger.reason, command: candidate, taskId: todo.id });
      if (danger.danger) {
        console.log('[autopilot] requiresApproval', project, todo.id || todo.title, candidate, danger.reason);
        // pause autopilot and store pending approval
        const s = loadState(); s.runState = 'paused'; saveState(s);
        pendingApprovals.set(project, { project, taskId: todo.id || todo.title, bash: candidate, dangerReason: danger.reason });
        wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'autopilot:requiresApproval', project, taskId: todo.id || todo.title, bash: candidate, dangerReason: danger.reason })); });
        logEvent({ type: 'POLICY_REQUIRES_APPROVAL', project, taskId: todo.id, command: candidate, code: danger.code, reason: danger.reason });
        return;
      }
    }

    // ask engineer
    const { obj, usage, raw } = await engineerAsk(todo, { project });
    if (!obj) {
      todo.status = 'blocked';
      todo.notes = (todo.notes || '') + '\nEngineer failed to produce result';
      savePlan(project, plan);
      wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
      return;
    }

    const bash = typeof obj.bash === 'string' ? obj.bash.trim() : '';
    const patch = typeof obj.patch === 'string' ? obj.patch.trim() : '';
    const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
    const danger = isDangerousBash(bash, project);
    logEvent({ type: 'POLICY_EVALUATED', project, taskId: todo.id, command: bash, action: danger.action || (danger.danger ? 'approval' : 'allow'), code: danger.code, reason: danger.reason });

    if (usage) {
      addCost(project, ENGINEER_MODEL, usage);
      // Check budget after adding cost
      const budgetCheck = checkBudgetExceeded(project);
      if (budgetCheck.exceeded) {
        console.log('[autopilot] budget exceeded', project, budgetCheck.spent, budgetCheck.budget);
        const s = loadState(); s.runState = 'paused_budget'; saveState(s);
        wss.clients.forEach((c) => { if (c.readyState === 1) {
          c.send(JSON.stringify({ type: 'cost:budgetExceeded', project, spent: budgetCheck.spent, budget: budgetCheck.budget }));
          c.send(JSON.stringify({ type: 'runState:updated', runState: 'paused_budget' }));
        }});
        todo.status = 'blocked';
        todo.notes = (todo.notes || '') + `\nBudget exceeded: ${budgetCheck.spent.toFixed(2)} >= ${budgetCheck.budget}`;
        savePlan(project, plan);
        wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
        return;
      }
    }

    const engResult = { ok: true, requiresApproval: danger.danger, dangerReason: danger.reason, bash, patch, summary, raw };
    wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'engineer:result', ...engResult })); });

    if (danger.danger) {
      // pause autopilot and store pending approval
      const s = loadState(); s.runState = 'paused'; saveState(s);
      pendingApprovals.set(project, { project, taskId: todo.id, bash, dangerReason: danger.reason });
      wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'autopilot:requiresApproval', project, taskId: todo.id, bash, dangerReason: danger.reason })); });
      logEvent({ type: 'POLICY_REQUIRES_APPROVAL', project, taskId: todo.id, command: bash, code: danger.code, reason: danger.reason });
      return;
    }

    // execute bash
    const term = projectTerm.get(project);
    if (bash && term) term.write(bash + '\r');

    await new Promise(r => setTimeout(r, 800));

    // PM verification using strict schema
    const { obj: pmObj, usage: pmUsage } = await pmVerify(todo, summary, bash);
    if (pmUsage) addCost(project, PM_MODEL, pmUsage);
    if (pmObj && typeof pmObj.done === 'boolean') {
      if (pmObj.done) {
        todo.status = 'done';
        todo.notes = (todo.notes || '') + '\n' + (pmObj.notes || 'Completed');
        if (pmObj.updates) {
          if (pmObj.updates.title) todo.title = pmObj.updates.title;
          if (typeof pmObj.updates.points === 'number') todo.points = pmObj.updates.points;
        }
        savePlan(project, plan);
        wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
        const newState = loadState();
        if (newState.runState === 'running') setTimeout(() => processNextTask(project), 300);
      } else if (pmObj.blocked) {
        todo.status = 'blocked';
        todo.notes = (todo.notes || '') + '\n' + (pmObj.notes || 'Blocked');
        savePlan(project, plan);
        wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
      } else {
        // not done, mark blocked
        todo.status = 'blocked';
        todo.notes = (todo.notes || '') + '\nPM did not mark done';
        savePlan(project, plan);
        wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
      }
    }
  } catch (e) {
    console.error('processNextTask error', e);
  } finally {
    projectProcessing.delete(project);
    if (globalInFlight > 0) globalInFlight--;
  }
}

// -----------------------------
// -----------------------------
// Schemas (strict + "required includes all properties keys")
// -----------------------------
// -----------------------------
// Guard - isDangerousBash now imported from ./src/core/safety.mjs
// -----------------------------

function getTaskCandidateBash(task) {
  if (!task || typeof task !== 'object') return '';
  // direct fields
  const direct = task.bash || task.cmd || task.command;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  // search textual fields for common destructive command lines (minimal: rm -rf)
  const hay = [task.title, task.summary, task.details, task.notes].filter(Boolean).join('\n');
  if (typeof hay === 'string') {
    const m = hay.match(/(^|\n|\s)(rm\s+-rf\s+[^\n;]+)/i);
    if (m) return m[2] || m[0].trim();
  }
  return '';
}

function extractUsage(resp) {
  // openai SDK response usage shape may vary
  const u = resp?.usage;
  if (!u) return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  const input = u.input_tokens ?? u.prompt_tokens ?? 0;
  const output = u.output_tokens ?? u.completion_tokens ?? 0;
  const total = u.total_tokens ?? (input + output);
  return { input_tokens: input, output_tokens: output, total_tokens: total };
}

async function callJSON(model, systemText, userText, schema) {
  const resp = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemText }],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: userText }],
      },
    ],
    // ✅ 你現在用的格式（避免之前踩過的坑）
    text: { format: { type: 'json_object' } },
  });

  const text = resp.output_text || '';
  let obj = null;
  try { obj = JSON.parse(text); } catch { obj = null; }
  return { obj, usage: extractUsage(resp), raw: text };
}

// -----------------------------
// Smoke Mode Wrappers (Deterministic Stubs)
// -----------------------------

function makeStableId(title) {
  return (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30) || 'task_' + Date.now();
}

async function engineerAsk(task, context) {
  if (isSmoke()) {
    // Deterministic stub
    const title = (task.title || '').toLowerCase();
    let bash = 'echo OK';
    
    if (title.includes('list') || title.includes('files')) {
      bash = 'pwd && ls';
    } else if (title.includes('danger') || title.includes('rm -rf')) {
      bash = 'rm -rf /tmp/agent-dashboard-danger-test';
    }
    
    return {
      obj: { bash, patch: '', summary: `Stub: executed ${bash}` },
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      raw: JSON.stringify({ bash, patch: '', summary: `Stub: executed ${bash}` })
    };
  }
  
  // Real OpenAI call
  const userText = `Project: ${context.project}\nTask: ${task.title}\nNotes: ${task.notes || ''}`;
  return await callJSON(ENGINEER_MODEL, ENGINEER_SYSTEM_PROMPT, userText, 'EngineerPlan');
}

async function pmPlanCreate(requirements, existingPlan) {
  if (isSmoke()) {
    // Deterministic stub: parse requirements by lines
    const lines = (requirements || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    
    let tasks = [];
    if (lines.length === 0) {
      // Default 3 tasks for testing
      tasks = [
        { id: 'task_list_files', title: 'Task 1: list files', points: 10, status: 'todo', verify: [], notes: '' },
        { id: 'task_danger_test', title: 'Task 2: danger test (rm -rf /tmp/agent-dashboard-danger-test)', points: 10, status: 'todo', verify: [], notes: '' },
        { id: 'task_verify_done', title: 'Task 3: verify done', points: 10, status: 'todo', verify: [], notes: '' }
      ];
    } else {
      tasks = lines.map((line, idx) => ({
        id: makeStableId(line) + '_' + idx,
        title: line,
        points: 10,
        status: 'todo',
        verify: [],
        notes: ''
      }));
    }
    
    return {
      obj: { tasks },
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      raw: JSON.stringify({ tasks })
    };
  }
  
  // Real OpenAI call
  const userText = `Project: ${existingPlan?.project || 'unknown'}\nRequirements:\n${requirements}`;
  return await callJSON(PM_MODEL, PM_PLAN_PROMPT, userText, 'PMPlan');
}

async function pmChangeRequest(changeRequest, existingPlan) {
  if (isSmoke()) {
    // Deterministic stub: merge with existing, preserve all statuses
    const lines = (changeRequest || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const existing = existingPlan || { tasks: [] };
    const existingTitles = new Set(existing.tasks.map(t => t.title));
    
    // Only add truly new tasks
    const newTasks = lines
      .filter(line => !existingTitles.has(line))
      .map((line, idx) => ({
        id: makeStableId(line) + '_' + idx,
        title: line,
        points: 10,
        status: 'todo',
        verify: [],
        notes: ''
      }));
    
    // Merge: keep all existing tasks (with their status), add new ones
    const allTasks = [...existing.tasks, ...newTasks];
    
    return {
      obj: { tasks: allTasks },
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      raw: JSON.stringify({ tasks: allTasks })
    };
  }
  
  // Real OpenAI call
  const userText = `Project: ${existingPlan?.project || 'unknown'}\nExisting plan:\n${JSON.stringify(existingPlan, null, 2)}\n\nChange request:\n${changeRequest}`;
  return await callJSON(PM_MODEL, PM_PLAN_PROMPT, userText, 'PMPlan');
}

async function pmVerify(task, terminalSummary, engineerSummary) {
  if (isSmoke()) {
    // Deterministic stub
    const text = [task.title, task.notes, terminalSummary, engineerSummary].join(' ').toLowerCase();
    
    if (text.includes('false') || text.includes('fail')) {
      return {
        obj: { done: false, blocked: true, notes: 'Stub: blocked due to false/fail' },
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        raw: JSON.stringify({ done: false, blocked: true, notes: 'Stub: blocked' })
      };
    }
    
    return {
      obj: { done: true, blocked: false, notes: 'Stub: done' },
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      raw: JSON.stringify({ done: true, blocked: false, notes: 'Stub: done' })
    };
  }
  
  // Real OpenAI call
  const pmUser = `Project: ${task.project || 'unknown'}\nTask: ${task.title}\nLogs: ${engineerSummary || terminalSummary}`;
  return await callJSON(PM_MODEL, PM_VERIFY_PROMPT, pmUser, 'PMVerify');
}

// -----------------------------
// HTTP + WS
// -----------------------------
const app = express();
app.use(express.json());
// -----------------------------
// Projects
// -----------------------------
// [rescue] commented duplicate: const PROJECTS_FILE = path.resolve(process.cwd(), 'data', 'projects.json');
function readProjects() {
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// -----------------------------
// Projects
// -----------------------------
// Projects
// -----------------------------

app.use(express.static('ui-dist'));

// ---- API: state ----
function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const obj = JSON.parse(raw);
    return normalizeState(obj || {});
  } catch (e) {
    const def = normalizeState({ total: 28, current: '1資料庫-3爬蟲軟體搭建', currentPct: 35, project: 'default' });
    try { fs.writeFileSync(STATE_FILE, JSON.stringify(def, null, 2)); } catch (e) {}
    return def;
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(normalizeState(state), null, 2));
    return true;
  } catch (e) {
    console.error('Failed to write state.json', e);
    return false;
  }
}

function normalizeState(s) {
  const total = Number.isFinite(Number(s.totalPct)) ? Number(s.totalPct) : Number(s.total);
  const currentPct = Number.isFinite(Number(s.currentPct)) ? Number(s.currentPct) : Number(s?.current?.pct);
  const current = typeof s.current === 'string' ? s.current : (s?.current?.label || '');
  const budget = Number.isFinite(Number(s.budget)) ? Number(s.budget) : null;
  return {
    total: Number.isFinite(total) ? total : 0,
    current,
    currentPct: Number.isFinite(currentPct) ? currentPct : 0,
    project: typeof s.project === 'string' ? s.project : 'default',
    runState: s.runState || 'idle',
    budget,
  };
}

app.get('/api/state', (req, res) => {
  res.json(loadState());
});


// ---- API: projects ----
app.get('/api/projects', (req, res) => {
  try {
    const { list } = loadProjects();
    res.json(Array.isArray(list) ? list : []);
  } catch (e) {
    res.status(500).json([]);
  }
});

// ---- API: runs ----
app.get('/api/runs', (req, res) => {
  try {
    const { project, limit } = req.query;
    if (!project) {
      return res.status(400).json({ error: 'Missing project parameter' });
    }
    
    const limitNum = parseInt(limit) || 20;
    const sessions = listRunSessions(project, limitNum);
    
    res.json(sessions);
  } catch (e) {
    console.error('[api/runs] error:', e);
    res.status(500).json({ error: 'Failed to list run sessions' });
  }
});

// ---- API: report ----
app.get('/api/report', (req, res) => {
  try {
    const { project, runSessionId } = req.query;
    if (!project) {
      return res.status(400).json({ error: 'Missing project parameter' });
    }
    
    // If runSessionId provided, validate it exists
    if (runSessionId) {
      const events = getRunEvents(project, runSessionId);
      if (!events || events.length === 0) {
        return res.status(404).json({ 
          error: 'runSessionId not found', 
          runSessionId, 
          project 
        });
      }
    }
    
    // If no runSessionId, default to latest
    const sessionId = runSessionId || getLatestRunSessionId(project);
    if (!sessionId) {
      return res.status(404).json({ 
        error: 'No run session found for project', 
        project 
      });
    }
    
    const events = getRunEvents(project, sessionId);
    const plan = loadPlan(project);
    const costs = loadCost();
    const cost = costs[project] || {};
    
    const markdown = buildMarkdownReport({
      project,
      plan,
      cost,
      events,
      runSessionId: sessionId
    });
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report_${project}_${sessionId}.md"`);
    res.send(markdown);
  } catch (e) {
    console.error('[api/report] error:', e);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ---- API: project-status (multi-project support) ----
app.get('/api/project-status', (req, res) => {
  try {
    const { project } = req.query;
    if (!project) {
      return res.status(400).json({ error: 'Missing project parameter' });
    }

    const plan = loadPlan(project);
    const costs = loadCost();
    const cost = costs[project] || {};
    const state = loadState();
    
    // Count task statuses
    const tasks = asArray(plan.tasks || []);
    const taskStats = {
      todo: tasks.filter(t => t.status === 'todo').length,
      doing: tasks.filter(t => t.status === 'doing').length,
      done: tasks.filter(t => t.status === 'done').length,
      total: tasks.length
    };

    res.json({
      project,
      tasks: taskStats,
      plan: { projectId: plan.projectId, tasks },
      cost,
      runState: state.runState || 'idle',
      progress: state.currentPct || 0
    });
  } catch (e) {
    console.error('[api/project-status] error:', e);
    res.status(500).json({ error: 'Failed to fetch project status' });
  }
});

// ---- API: project-health (multi-project health metrics) ----
app.get('/api/project-health', (req, res) => {
  try {
    const { project } = req.query;
    if (!project) {
      return res.status(400).json({ error: 'Missing project parameter' });
    }

    const plan = loadPlan(project);
    const costs = loadCost();
    const cost = costs[project] || {};
    const state = loadState();
    const sessions = listRunSessions(project, 10);
    
    // Calculate health metrics
    const tasks = asArray(plan.tasks || []);
    const totalPoints = tasks.reduce((s, t) => s + (Number(t.points) || 0), 0) || 1;
    const donePoints = tasks.reduce((s, t) => s + ((t.status === 'done') ? (Number(t.points) || 0) : 0), 0);
    const progressPct = Math.round((donePoints / totalPoints) * 100);
    
    // Calculate cost health
    const budget = Number(state.budget) || 1000;
    const spent = Number(cost.spent) || 0;
    const costHealth = spent > budget ? 'critical' : spent > (budget * 0.8) ? 'warning' : 'healthy';
    
    // Get last session status
    const latestSession = sessions[0];
    const lastSessionTime = latestSession ? new Date(latestSession.startTime) : new Date();
    const timeSinceLastRun = Date.now() - lastSessionTime.getTime();
    const inactiveWarning = timeSinceLastRun > (24 * 60 * 60 * 1000); // > 24 hours
    
    res.json({
      project,
      health: {
        progress: progressPct,
        costHealth,
        cost: { spent, budget },
        lastRun: lastSessionTime.toISOString(),
        sessionCount: sessions.length
      },
      warnings: [
        ...(costHealth === 'critical' ? [`Budget exceeded: $${spent.toFixed(2)} / $${budget.toFixed(2)}`] : []),
        ...(costHealth === 'warning' ? [`Budget warning: ${((spent / budget) * 100).toFixed(1)}% spent`] : []),
        ...(inactiveWarning ? [`No runs in last 24 hours`] : []),
        ...(tasks.length === 0 ? [`No tasks defined in plan`] : [])
      ]
    });
  } catch (e) {
    console.error('[api/project-health] error:', e);
    res.status(500).json({ error: 'Failed to fetch project health' });
  }
});

// ---- API: audit-export (approval history export) ----
app.get('/api/audit-export', (req, res) => {
  try {
    const { project, format = 'json' } = req.query;
    if (!project) {
      return res.status(400).json({ error: 'Missing project parameter' });
    }

    // Get all events for the project
    const sessions = listRunSessions(project, 100);
    const allEvents = [];
    
    for (const session of sessions) {
      const events = getRunEvents(project, session.runSessionId) || [];
      // Filter for approval-related events
      const approvalEvents = events.filter(e => 
        e.type === 'DANGER_APPROVED' || 
        e.type === 'DANGER_REJECTED' || 
        e.type === 'POLICY_REQUIRES_APPROVAL'
      );
      allEvents.push(...approvalEvents);
    }

    // Sort by timestamp descending
    allEvents.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit_${project}_${Date.now()}.json"`);
      res.send(JSON.stringify(allEvents, null, 2));
    } else if (format === 'csv') {
      // CSV export
      const csvHeader = 'Timestamp,Type,Command,Severity,Reason,Approved By,Notes\n';
      const csvRows = allEvents.map(e => {
        const timestamp = new Date(e.ts).toISOString();
        const type = e.type || 'UNKNOWN';
        const command = (e.command || '').replace(/"/g, '""');
        const severity = e.severity || 'UNKNOWN';
        const reason = (e.reason || '').replace(/"/g, '""');
        const approvedBy = e.approver || 'SYSTEM';
        const notes = (e.notes || '').replace(/"/g, '""');
        return `"${timestamp}","${type}","${command}","${severity}","${reason}","${approvedBy}","${notes}"`;
      });
      const csv = csvHeader + csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit_${project}_${Date.now()}.csv"`);
      res.send(csv);
    } else if (format === 'html') {
      // HTML export
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Audit Report - ${project}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; background: white; }
    th { background: #f0f0f0; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    tr:hover { background: #f9f9f9; }
    .critical { background: #ffebee; color: #c62828; }
    .warning { background: #fff9c4; color: #f57f17; }
    .approved { background: #e8f5e9; color: #2e7d32; }
    .rejected { background: #ffebee; color: #c62828; }
  </style>
</head>
<body>
  <h1>Audit Report: ${project}</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  <p>Total events: ${allEvents.length}</p>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Type</th>
        <th>Command</th>
        <th>Severity</th>
        <th>Reason</th>
        <th>Approver</th>
      </tr>
    </thead>
    <tbody>
      ${allEvents.map(e => `
      <tr class="${e.type === 'DANGER_APPROVED' ? 'approved' : e.type === 'DANGER_REJECTED' ? 'rejected' : e.severity === 'critical' ? 'critical' : 'warning'}">
        <td>${new Date(e.ts).toISOString()}</td>
        <td><strong>${e.type || 'UNKNOWN'}</strong></td>
        <td><code>${(e.command || '').substring(0, 100)}</code></td>
        <td>${e.severity || 'UNKNOWN'}</td>
        <td>${e.reason || '-'}</td>
        <td>${e.approver || 'SYSTEM'}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit_${project}_${Date.now()}.html"`);
      res.send(html);
    } else {
      res.status(400).json({ error: 'Unsupported format. Use json, csv, or html.' });
    }
  } catch (e) {
    console.error('[api/audit-export] error:', e);
    res.status(500).json({ error: 'Failed to export audit log' });
  }
});

// ---- API: replay-events (cloud replay - get events) ----
app.get('/api/replay-events', async (req, res) => {
  try {
    const { project, sessionId, startTs, endTs, eventType } = req.query;
    if (!project || !sessionId) {
      return res.status(400).json({ error: 'Missing project or sessionId parameter' });
    }

    const storage = getStorageClient();
    const filter = {};
    if (startTs) filter.startTs = startTs;
    if (endTs) filter.endTs = endTs;
    if (eventType) filter.eventType = eventType;

    const events = await storage.getEvents(project, sessionId, filter);
    
    res.json({
      project,
      sessionId,
      eventCount: events.length,
      events
    });
  } catch (e) {
    console.error('[api/replay-events] error:', e);
    res.status(500).json({ error: 'Failed to retrieve replay events' });
  }
});

// ---- API: replay-session (cloud replay - get session info) ----
app.get('/api/replay-session', async (req, res) => {
  try {
    const { project, sessionId } = req.query;
    if (!project || !sessionId) {
      return res.status(400).json({ error: 'Missing project or sessionId parameter' });
    }

    const storage = getStorageClient();
    const summary = await storage.getSessionSummary(project, sessionId);
    
    if (!summary) {
      return res.status(404).json({ error: 'Session not found', project, sessionId });
    }

    res.json({
      project,
      sessionId,
      summary
    });
  } catch (e) {
    console.error('[api/replay-session] error:', e);
    res.status(500).json({ error: 'Failed to retrieve session info' });
  }
});

// ---- API: replay-sessions (list sessions for project) ----
app.get('/api/replay-sessions', async (req, res) => {
  try {
    const { project, limit } = req.query;
    if (!project) {
      return res.status(400).json({ error: 'Missing project parameter' });
    }

    const storage = getStorageClient();
    const limitNum = parseInt(limit) || 50;
    const sessions = await storage.listSessions(project);
    
    res.json({
      project,
      sessionCount: sessions.length,
      sessions: sessions.slice(0, limitNum)
    });
  } catch (e) {
    console.error('[api/replay-sessions] error:', e);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// ---- API: queue status ----
app.get('/api/queue/status', (req, res) => {
  try {
    const qm = getQueueManager({ maxConcurrentProjects: GLOBAL_CONCURRENCY });
    const { project } = req.query;
    if (project) {
      const p = qm.getProjectStatus(project);
      if (!p) return res.status(404).json({ error: 'Project not found or no queue', project });
      return res.json(p);
    }
    const g = qm.getGlobalStatus();
    // Fallback enrichment from plan when queue has no data
    if (!g || (g.projectCount === 0)) {
      const { list } = loadProjects();
      const snapshot = list.map(p => {
        const plan = loadPlan(p.id);
        const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
        return {
          projectId: p.id,
          stats: {
            queued: tasks.filter(t => !t.status || t.status === 'todo').length,
            running: tasks.filter(t => t.status === 'doing').length,
            completed: tasks.filter(t => t.status === 'done').length,
            failed: 0
          }
        };
      });
      return res.json({
        maxConcurrentProjects: GLOBAL_CONCURRENCY,
        currentConcurrentProjects: 0,
        activeProjects: snapshot.filter(s => s.stats.queued || s.stats.running).map(s => s.projectId),
        projectCount: snapshot.length,
        globalStats: { tasksEnqueued: 0, tasksCompleted: 0, tasksFailed: 0 },
        allProjectStats: Object.fromEntries(snapshot.map(s => [s.projectId, s.stats])),
        uptime: process.uptime()
      });
    }
    res.json(g);
  } catch (e) {
    console.error('[api/queue/status] error:', e);
    res.status(500).json({ error: 'Failed to fetch queue status' });
  }
});

// ---- API: policy approvals ----
app.get('/api/policy/pending', (req, res) => {
  try {
    const engine = getPolicyEngine({ enableAuditLogging: true });
    const pending = engine.getPendingApprovals();
    // Merge legacy pendingApprovals map
    for (const [project, p] of pendingApprovals.entries()) {
      pending.push({
        taskId: p.taskId,
        projectId: project,
        command: p.bash,
        severity: 'high',
        status: 'pending_approval',
        timestamp: new Date().toISOString()
      });
    }
    res.json({ pending });
  } catch (e) {
    console.error('[api/policy/pending] error:', e);
    res.status(500).json({ error: 'Failed to list pending approvals' });
  }
});

async function approvePendingCommand(project, approverInfo = {}) {
  const pending = pendingApprovals.get(project);
  if (!pending) throw new Error('no pending approval');

  console.log('[autopilot] approve via HTTP', project, pending.taskId, pending.bash);
  logEvent({ type: 'DANGER_APPROVED', project, taskId: pending.taskId, bash: pending.bash, approver: approverInfo.approverName || approverInfo.approverId });

  const termForProject = projectTerm.get(project);
  if (termForProject && pending.bash) {
    termForProject.write(pending.bash + '\r');
  }
  await new Promise(r => setTimeout(r, 800));

  // run PM verify for the task
  try {
    const plan = loadPlan(project);
    const task = (plan.tasks || []).find(t => t.id === pending.taskId || t.title === pending.taskId);
    if (task) {
      const { obj: pmObj, usage: pmUsage } = await pmVerify(task, `Executed approval bash: ${pending.bash}`, pending.bash);
      if (pmUsage) addCost(project, PM_MODEL, pmUsage);
      if (pmObj && typeof pmObj.done === 'boolean') {
        if (pmObj.done) {
          task.status = 'done';
          task.notes = (task.notes || '') + '\n' + (pmObj.notes || 'Completed after approval');
          if (pmObj.updates) {
            if (pmObj.updates.title) task.title = pmObj.updates.title;
            if (typeof pmObj.updates.points === 'number') task.points = pmObj.updates.points;
          }
          logEvent({ type: 'TASK_FINISHED', project, taskId: task.id, taskTitle: task.title, status: 'done' });
        } else if (pmObj.blocked) {
          task.status = 'blocked';
          task.notes = (task.notes || '') + '\n' + (pmObj.notes || 'Blocked after approval');
          logEvent({ type: 'TASK_FINISHED', project, taskId: task.id, taskTitle: task.title, status: 'blocked' });
        } else {
          task.status = 'blocked';
          task.notes = (task.notes || '') + '\nPM did not mark done after approval';
          logEvent({ type: 'TASK_FINISHED', project, taskId: task.id, taskTitle: task.title, status: 'blocked' });
        }
        savePlan(project, plan);
        wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
      }
    }
  } catch (e) {
    console.error('HTTP approve pm verify error', e);
  }

  // clear pending and resume
  pendingApprovals.delete(project);
  const s = loadState(); s.runState = 'running'; saveState(s);
  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'runState:updated', runState: 'running' })); });
  setTimeout(() => processNextTask(project), 300);
  return { ok: true };
}

app.post('/api/policy/approve', async (req, res) => {
  try {
    const { project, taskId, approverId, approverName } = req.body || {};
    if (!project) return res.status(400).json({ error: 'Missing project' });
    const result = await approvePendingCommand(project, { approverId, approverName });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Approval failed' });
  }
});

app.post('/api/policy/reject', async (req, res) => {
  try {
    const { project, taskId, rejectorId, rejectorName, rejectionReason } = req.body || {};
    if (!project) return res.status(400).json({ error: 'Missing project' });
    const pending = pendingApprovals.get(project);
    if (!pending || (taskId && pending.taskId !== taskId)) return res.status(404).json({ error: 'No matching pending approval' });

    logEvent({ type: 'DANGER_REJECTED', project, taskId: pending.taskId, bash: pending.bash, reason: rejectionReason, rejector: rejectorName || rejectorId });
    pendingApprovals.delete(project);
    const s = loadState(); s.runState = 'paused'; saveState(s);
    wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'runState:updated', runState: 'paused' })); });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Reject failed' });
  }
});

// ---- API: advanced query (single project session) ----
app.get('/api/query/events', async (req, res) => {
  try {
    const { project, sessionId, types, severity, start, end, status, limit, offset } = req.query;
    if (!project || !sessionId) return res.status(400).json({ error: 'Missing project or sessionId' });
    const storage = getStorageClient();
    const engine = getStorageQueryEngine(storage);
    const filters = {
      types: types ? String(types).split(',').filter(Boolean) : undefined,
      severity: severity ? String(severity).split(',').filter(Boolean) : undefined,
      startTime: start,
      endTime: end,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined
    };
    const events = await engine.queryEvents(project, sessionId, filters);
    res.json({ project, sessionId, count: events.length, events });
  } catch (e) {
    console.error('[api/query/events] error:', e);
    res.status(500).json({ error: 'Failed to query events' });
  }
});

// ---- API: advanced cross-project query ----
app.get('/api/query/projects', async (req, res) => {
  try {
    const { projects, sessionId, types, severity, start, end, status, limit, offset } = req.query;
    const storage = getStorageClient();
    const engine = getStorageQueryEngine(storage);
    const filters = {
      projects: projects ? String(projects).split(',').filter(Boolean) : undefined,
      sessionId,
      types: types ? String(types).split(',').filter(Boolean) : undefined,
      severity: severity ? String(severity).split(',').filter(Boolean) : undefined,
      startTime: start,
      endTime: end,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined
    };
    const events = await engine.queryAcrossProjects(filters);
    res.json({ count: events.length, events });
  } catch (e) {
    console.error('[api/query/projects] error:', e);
    res.status(500).json({ error: 'Failed to query across projects' });
  }
});

// ---- API: storage-stats (get cloud storage statistics) ----
app.get('/api/storage-stats', async (req, res) => {
  try {
    const storage = getStorageClient();
    const stats = await storage.getStats();
    
    res.json({
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('[api/storage-stats] error:', e);
    res.status(500).json({ error: 'Failed to get storage stats' });
  }
});

// ---- API: compliance/run (execute active compliance checks) ----
app.post('/api/compliance/run', async (req, res) => {
  try {
    const { projectId, all } = req.body || {};

    // Determine which projects to run
    const options = {};
    if (projectId) {
      options.projectId = projectId;
    } else if (all === true) {
      options.all = true;
    } else {
      // Default: run all projects
      options.all = true;
    }

    // Execute compliance checks
    const results = await runCompliance(options);

    // Return summary (not full logs; logs are in evidence files)
    const summary = {
      timestamp: new Date().toISOString(),
      projectsRun: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      warned: results.filter(r => r.status === 'warn').length,
      failed: results.filter(r => r.status === 'fail').length,
      results: results.map(r => ({
        projectId: r.projectId,
        projectName: r.projectName,
        status: r.status,
        checksCount: r.checks ? r.checks.length : 0,
        durationMs: r.durationMs,
        evidencePath: r.evidencePath
      }))
    };

    res.json(summary);
  } catch (e) {
    console.error('[api/compliance/run] error:', e);
    res.status(500).json({ error: 'Failed to run compliance checks' });
  }
});

// ---- API: compliance/status (get latest compliance status for project) ----
app.get('/api/compliance/status', (req, res) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      // Return all projects with their latest compliance status
      const allProjects = getAllProjectsWithStatus();
      return res.json({
        timestamp: new Date().toISOString(),
        projects: allProjects.map(p => ({
          projectId: p.projectId,
          name: p.name,
          baseUrl: p.baseUrl,
          compliance: p.compliance,
          latestStatus: p.latestCompliance ? {
            status: p.latestCompliance.status,
            lastRunAt: p.latestCompliance.lastRunAt,
            durationMs: p.latestCompliance.durationMs,
            checksCount: p.latestCompliance.checksCount,
            checksPassed: p.latestCompliance.checksPassed,
            checksWarned: p.latestCompliance.checksWarned,
            checksFailed: p.latestCompliance.checksFailed,
            evidencePath: p.latestCompliance.evidencePath
          } : null
        }))
      });
    }

    // Get status for a specific project
    const status = getLatestComplianceStatus(projectId);
    if (!status) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Include passive compliance status
    const passive = getPassiveComplianceStatus(projectId);

    res.json({
      timestamp: new Date().toISOString(),
      projectId,
      active: status,
      passive
    });
  } catch (e) {
    console.error('[api/compliance/status] error:', e);
    res.status(500).json({ error: 'Failed to get compliance status' });
  }
});

// ---- API: compliance/passive (platform-derived compliance) ----
// OPEN-ONLY: This endpoint is disabled in open release
app.get('/api/compliance/passive', (req, res) => {
  res.status(501).json({ 
    error: 'Not implemented in Open Core',
    feature: 'Passive compliance from platform SSOT',
    requires: 'paid-platform module'
  });
});

// ---- API: Platform SSOT endpoints (v5.0) ----

// GET /api/platform/auth/me - Current user (OPEN-ONLY: Disabled)
app.get('/api/platform/auth/me', (req, res) => {
  res.status(501).json({ 
    error: 'Not implemented in Open Core',
    feature: 'Platform authentication',
    requires: 'paid-platform module'
  });
});

// GET /api/platform/entitlements - Get entitlements (OPEN-ONLY: Disabled)
app.get('/api/platform/entitlements', (req, res) => {
  res.status(501).json({ 
    error: 'Not implemented in Open Core',
    feature: 'Entitlement management',
    requires: 'paid-platform module'
  });
});

// POST /api/platform/admin/entitlements/grant - Grant entitlement (OPEN-ONLY: Disabled)
app.post('/api/platform/admin/entitlements/grant', express.json(), (req, res) => {
  res.status(501).json({ 
    error: 'Not implemented in Open Core',
    feature: 'Grant entitlements',
    requires: 'paid-platform module'
  });
});

// POST /api/platform/admin/entitlements/revoke - Revoke entitlement (OPEN-ONLY: Disabled)
app.post('/api/platform/admin/entitlements/revoke', express.json(), (req, res) => {
  res.status(501).json({ 
    error: 'Not implemented in Open Core',
    feature: 'Revoke entitlements',
    requires: 'paid-platform module'
  });
});

// POST /api/platform/events - Ingest event (OPEN-ONLY: Disabled)
app.post('/api/platform/events', express.json(), (req, res) => {
  res.status(501).json({ 
    error: 'Not implemented in Open Core',
    feature: 'Platform event ingestion',
    requires: 'paid-platform module'
  });
});

// GET /api/platform/admin/events - Query events (OPEN-ONLY: Disabled)
app.get('/api/platform/admin/events', (req, res) => {
  res.status(501).json({ 
    error: 'Not implemented in Open Core',
    feature: 'Platform event querying',
    requires: 'paid-platform module'
  });
});

// GET /api/platform/admin/metrics - Get metrics (OPEN-ONLY: Disabled)
app.get('/api/platform/admin/metrics', (req, res) => {
  res.status(501).json({ 
    error: 'Not implemented in Open Core',
    feature: 'Metrics calculation',
    requires: 'paid-platform module'
  });
});

// GET /api/platform/admin/compliance - Get compliance (OPEN-ONLY: Disabled)
app.get('/api/platform/admin/compliance', (req, res) => {
  res.status(501).json({ 
    error: 'Not implemented in Open Core',
    feature: 'Platform compliance status',
    requires: 'paid-platform module'
  });
});

// ---- API: generate-report (multi-format report generation) ----
app.get('/api/generate-report', async (req, res) => {
  try {
    const { project, sessionId, format } = req.query;
    
    if (!project || !sessionId) {
      return res.status(400).json({ error: 'Missing project or sessionId parameter' });
    }
    
    if (!format || !['json', 'csv', 'html', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use json, csv, html, or pdf.' });
    }

    const storage = getStorageClient();
    
    // Get events, session summary, plan, and cost data
    const events = await storage.getEvents(project, sessionId);
    const summary = await storage.getSessionSummary(project, sessionId);
    const plan = loadPlan(project);
    const cost = loadCost();

    // Generate report
    const { generateAndStoreReport } = await import('./src/core/reportGenerator.mjs');
    const result = await generateAndStoreReport(project, sessionId, plan, cost, events, summary);

    if (format === 'json') {
      const { ReportBuilder } = await import('./src/core/reportGenerator.mjs');
      const builder = new ReportBuilder(project, sessionId, plan, cost, events, summary);
      const jsonContent = builder.generateJSON();
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="report_${project}_${sessionId}.json"`);
      res.send(jsonContent);
    } else if (format === 'csv') {
      const { ReportBuilder } = await import('./src/core/reportGenerator.mjs');
      const builder = new ReportBuilder(project, sessionId, plan, cost, events, summary);
      const csvContent = builder.generateCSV();
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report_${project}_${sessionId}.csv"`);
      res.send(csvContent);
    } else if (format === 'html' || format === 'pdf') {
      const { ReportBuilder } = await import('./src/core/reportGenerator.mjs');
      const builder = new ReportBuilder(project, sessionId, plan, cost, events, summary);
      const htmlContent = builder.generateHTML();
      
      if (format === 'html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="report_${project}_${sessionId}.html"`);
        res.send(htmlContent);
      } else {
        // PDF: Return HTML for now (client can render as PDF or we can add puppeteer later)
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="report_${project}_${sessionId}.html"`);
        res.send(htmlContent);
      }
    }
  } catch (e) {
    console.error('[api/generate-report] error:', e);
    res.status(500).json({ error: 'Failed to generate report', message: e.message });
  }
});

const server = http.createServer(app);

// Safety net: never allow unhandled server 'error' to crash the process.
// startServerWithRetry() will handle EADDRINUSE; this is just to avoid "Unhandled 'error' event".
server.on('error', (err) => {
  try {
    if (!err || err.code !== 'EADDRINUSE') console.error('[server] error event:', err && err.code ? err.code : err);
  } catch {}
});


const wss = new WebSocketServer({ server });


// Safety net: prevent "Unhandled 'error' event" from ws WebSocketServer
wss.on('error', (err) => {
  try {
    if (!err || err.code !== 'EADDRINUSE') console.error('[wss] error event:', err && (err && err.code) ? err.code : err);
  } catch {
    if (!err || err.code !== 'EADDRINUSE') console.error('[wss] error event');
  }
});
// Set up runlog event callback to broadcast to WebSocket clients
import { setEventCallback } from './src/core/runlog.mjs';

/* __OPEN_CLI_PORT_ENV_V1__
   Open Core: honor CLI port early.
   Supports: node server.mjs --port 12345  OR  node server.mjs --port=12345
*/
{
  const argv = process.argv || [];
  let p = null;
  const i = argv.indexOf("--port");
  if (i >= 0 && i + 1 < argv.length) p = argv[i + 1];
  const eq = argv.find(a => typeof a === "string" && a.startsWith("--port="));
  if (!p && eq) p = eq.split("=", 2)[1];
  if (p != null && p !== "") process.env.PORT = String(p);
}
setEventCallback((event) => {
  wss.clients.forEach((c) => {
    if (c.readyState === 1) {
      c.send(JSON.stringify({ type: 'runlog:event', event }));
    }
  });
});

function broadcastState(state) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(JSON.stringify({ type: 'state:updated', state }));
  });
}

// V4.2: Helper to build project summary
async function buildProjectSummary(project) {
  try {
    const events = getRunEvents(project) || [];
    const plan = loadPlan(project);
    
    // Find latest context snapshot
    const contextSnapshot = [...events].reverse().find(e => e.type === 'CONTEXT_SNAPSHOT');
    
    // Get recent events (last 30)
    const recentEvents = events.slice(-30);
    
    // Build summary (LLM or offline)
    const summaryText = await buildSummary(contextSnapshot, recentEvents, plan);
    
    return summaryText;
  } catch (err) {
    console.error('buildProjectSummary error:', err);
    return `Error building summary: ${err.message}`;
  }
}

// V4.2: Trigger summary update with throttling
let lastSummaryTime = 0;
const SUMMARY_THROTTLE_MS = 10000; // Don't update more than once per 10 seconds

async function triggerSummaryUpdate(project) {
  const now = Date.now();
  if (now - lastSummaryTime < SUMMARY_THROTTLE_MS) {
    return; // Throttled
  }
  
  lastSummaryTime = now;
  
  try {
    const summaryText = await buildProjectSummary(project);
    const updatedAt = new Date().toISOString();
    
    sessionSummaries.set(project, { summaryText, updatedAt });
    
    // Broadcast to clients
    wss.clients.forEach((c) => {
      if (c.readyState === 1) {
        c.send(JSON.stringify({
          type: 'summary:updated',
          project,
          runSessionId: getCurrentRunSessionId(project),
          summaryText,
          updatedAt
        }));
      }
    });
  } catch (err) {
    console.error('triggerSummaryUpdate error:', err);
  }
}

wss.on('connection', (ws) => {
    // Safety net: never crash on per-socket error
  ws.on('error', (err) => {
    try { console.error('[ws] error:', (err && err.code) ? err.code : err); } catch {}
  });

const currentState = loadState();
  let activeProjectId = PROJECTS.map.has(currentState.project) ? currentState.project : (PROJECTS.list[0]?.id || 'default');
  let term = createTerm(activeProjectId);
  let sub = null;

  function attach(projectId) {
    activeProjectId = projectId;
    if (sub && typeof sub.dispose === 'function') sub.dispose();
    if (term && typeof term.kill === 'function') term.kill();
    term = createTerm(activeProjectId);

    sub = term.onData((data) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'term:data', data }));
    });

    // record latest term for this project so autopilot can use it
    projectTerm.set(activeProjectId, term);

    // push current usage summary
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'project:active', projectId: activeProjectId }));
      ws.send(JSON.stringify({ type: 'usage:summary', summary: summarizeUsage(activeProjectId) }));
      ws.send(JSON.stringify({ type: 'term:data', data: `\r\n[Project switched to ${activeProjectId}] cwd=${PROJECTS.map.get(activeProjectId)?.cwd || process.env.HOME}\r\n` }));
    }
  }

  // initial payload
  ws.send(JSON.stringify({ type: 'project:list', projects: PROJECTS.list.map(p => ({ id: p.id, label: p.label || p.name || p.id })), activeProject: activeProjectId }));
  ws.send(JSON.stringify({ type: 'projects:list', projects: PROJECTS.list, engineer_model: ENGINEER_MODEL, pm_model: PM_MODEL, usd_to_twd: USD_TO_TWD }));
  ws.send(JSON.stringify({ type: 'state:updated', state: { ...currentState, project: activeProjectId } }));
  // send current plan and cost summary
  try {
    const plan = loadPlan(activeProjectId);
    ws.send(JSON.stringify({ type: 'plan:updated', plan }));
  } catch (e) {}
  try {
    const costs = loadCost();
    ws.send(JSON.stringify({ type: 'cost:updated', cost: costs[activeProjectId] || {} }));
  } catch (e) {}
  attach(activeProjectId);

  ws.on('message', async (raw) => {
    const msg = safeJsonParse(raw);
    // MSG_GUARD_INSERTED: ws message may be empty / not-json / not-object
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
    // ---- normalize UI message types ----
    if (msg.type === 'engineer:run') msg.type = 'engineer:ask';
    if (msg.type === 'pm:run') msg.type = 'pm:ask';
    if (msg.type === 'engineer') msg.type = 'engineer:ask';
    if (msg.type === 'pm') msg.type = 'pm:ask';

    if (msg && msg.type === 'term:write') {
      term.write(msg.data);
      return;
    }
    if (msg && msg.type === 'term:ctrlc') {
      term.write('\x03'); // Ctrl+C
      return;
    }
    if (msg && msg.type === 'project:set') {
      const pid = msg.project || msg.projectId;
      if (PROJECTS.map.has(pid)) {
        attach(pid);
        const merged = normalizeState(Object.assign({}, loadState(), { project: pid }));
        saveState(merged);
        broadcastState(merged);
      }
      return;
    }

    // ---- State management ----
    if (msg && msg.type === 'state:get') {
      const s = loadState();
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'state:updated', state: s }));
      return;
    }

    if (msg && msg.type === 'plan:get') {
      const project = msg.project || activeProjectId;
      const plan = loadPlan(project);
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'plan:updated', plan }));
      return;
    }

    if (msg && msg.type === 'plan:update') {
      const project = msg.project || activeProjectId;
      const plan = msg.plan || {};
      // preserve existing done statuses where possible
      const existing = loadPlan(project) || { tasks: [] };
      const byId = new Map(existing.tasks.map(t => [t.id, t]));
      const merged = { projectId: project, tasks: (plan.tasks || []).map(t => ({ ...t, status: byId.get(t.id)?.status || t.status || 'todo' })) };
      savePlan(project, merged);
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'plan:updated', plan: merged }));
      // broadcast to all clients
      wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan: merged })); });
      return;
    }

    if (msg && msg.type === 'pm:plan_create') {
      if (!isSmoke() && !hasKey) {
        ws.send(JSON.stringify({ type: 'pm:plan_create:result', ok: false, error: 'OPENAI_API_KEY missing' }));
        return;
      }
      const project = msg.project || activeProjectId;
      const req = msg.requirements || msg.prompt || '';
      try {
        const existing = loadPlan(project) || { tasks: [] };
        const { obj, usage, raw } = await pmPlanCreate(req, existing);
        if (!obj || !Array.isArray(obj.tasks)) {
          ws.send(JSON.stringify({ type: 'pm:plan_create:result', ok: false, raw }));
          return;
        }
        // merge with existing plan, preserve done tasks
        const byTitle = new Map(existing.tasks.map(t => [t.title, t]));
        const byId = new Map(existing.tasks.map(t => [t.id, t]));
        const tasks = (obj.tasks || []).map((t, idx) => {
          let keep = {};
          if (t.id && byId.has(t.id)) keep = byId.get(t.id);
          else if (byTitle.has(t.title)) keep = byTitle.get(t.title);
          const id = t.id || keep.id || (t.title ? (t.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + idx) : `task_${Date.now()}_${idx}`);
          const status = keep.status === 'done' ? 'done' : (t.status || 'todo');
          return { id, title: t.title, points: Number(t.points) || 1, status, verify: Array.isArray(t.verify) ? t.verify : [], notes: t.notes || keep.notes || '' };
        });
        const plan = { project: project, requirements: req, tasks };
        savePlan(project, plan);
        wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
        if (usage) addCost(project, PM_MODEL, usage);
        ws.send(JSON.stringify({ type: 'pm:plan_create:result', ok: true, plan }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'pm:plan_create:result', ok: false, error: String(e?.message || e) }));
      }
      return;
    }

    if (msg && msg.type === 'pm:change_request') {
      if (!isSmoke() && !hasKey) {
        ws.send(JSON.stringify({ type: 'pm:change_request:result', ok: false, error: 'OPENAI_API_KEY missing' }));
        return;
      }
      const project = msg.project || activeProjectId;
      const changeRequest = msg.changeRequest || msg.request || '';
      const existingPlan = msg.plan || loadPlan(project);
      
      try {
        const { obj, usage, raw } = await pmChangeRequest(changeRequest, existingPlan);
        if (!obj || !Array.isArray(obj.tasks)) {
          ws.send(JSON.stringify({ type: 'pm:change_request:result', ok: false, raw }));
          return;
        }
        
        // merge with existing plan, PRESERVE done statuses
        const existing = existingPlan || { tasks: [] };
        const byTitle = new Map(existing.tasks.map(t => [t.title, t]));
        const byId = new Map(existing.tasks.map(t => [t.id, t]));
        const tasks = (obj.tasks || []).map((t, idx) => {
          let keep = {};
          if (t.id && byId.has(t.id)) keep = byId.get(t.id);
          else if (byTitle.has(t.title)) keep = byTitle.get(t.title);
          const id = t.id || keep.id || (t.title ? (t.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + idx) : `task_${Date.now()}_${idx}`);
          // CRITICAL: preserve done status
          const status = keep.status === 'done' ? 'done' : (t.status || 'todo');
          return { id, title: t.title, points: Number(t.points) || 1, status, verify: Array.isArray(t.verify) ? t.verify : [], notes: t.notes || keep.notes || '' };
        });
        const plan = { project: project, requirements: existingPlan.requirements || '', tasks };
        savePlan(project, plan);
        wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
        if (usage) addCost(project, PM_MODEL, usage);
        ws.send(JSON.stringify({ type: 'pm:change_request:result', ok: true, plan }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'pm:change_request:result', ok: false, error: String(e?.message || e) }));
      }
      return;
    }

    if (msg && msg.type === 'autopilot:approve') {
      const project = msg.project || activeProjectId;
      const pending = pendingApprovals.get(project);
      if (!pending) {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'autopilot:approve:result', ok: false, error: 'no pending approval' }));
        return;
      }
      // execute pending bash, then PM-verify the task and resume autopilot
      console.log('[autopilot] approve execute', project, pending.taskId, pending.bash);
      
      logEvent({ type: 'DANGER_APPROVED', project, taskId: pending.taskId, bash: pending.bash });
      
      const termForProject = projectTerm.get(project);
      if (termForProject && pending.bash) {
        termForProject.write(pending.bash + '\r');
      }
      // small wait to allow output
      await new Promise(r => setTimeout(r, 800));

      // run PM verify for the task
      try {
        const plan = loadPlan(project);
        const task = (plan.tasks || []).find(t => t.id === pending.taskId || t.title === pending.taskId);
        if (task) {
          const { obj: pmObj, usage: pmUsage } = await pmVerify(task, `Executed approval bash: ${pending.bash}`, pending.bash);
          if (pmUsage) addCost(project, PM_MODEL, pmUsage);
          if (pmObj && typeof pmObj.done === 'boolean') {
            if (pmObj.done) {
              task.status = 'done';
              task.notes = (task.notes || '') + '\n' + (pmObj.notes || 'Completed after approval');
              if (pmObj.updates) {
                if (pmObj.updates.title) task.title = pmObj.updates.title;
                if (typeof pmObj.updates.points === 'number') task.points = pmObj.updates.points;
              }
              logEvent({ type: 'TASK_FINISHED', project, taskId: task.id, taskTitle: task.title, status: 'done' });
            } else if (pmObj.blocked) {
              task.status = 'blocked';
              task.notes = (task.notes || '') + '\n' + (pmObj.notes || 'Blocked after approval');
              logEvent({ type: 'TASK_FINISHED', project, taskId: task.id, taskTitle: task.title, status: 'blocked' });
            } else {
              task.status = 'blocked';
              task.notes = (task.notes || '') + '\nPM did not mark done after approval';
              logEvent({ type: 'TASK_FINISHED', project, taskId: task.id, taskTitle: task.title, status: 'blocked' });
            }
            savePlan(project, plan);
            wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
          }
        }
      } catch (e) {
        console.error('autopilot:approve pm verify error', e);
      }

      // clear pending and resume
      pendingApprovals.delete(project);
      const s = loadState(); s.runState = 'running'; saveState(s);
      wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'runState:updated', runState: 'running' })); });
      // continue loop
      setTimeout(() => processNextTask(project), 300);
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'autopilot:approve:result', ok: true }));
      return;
    }

    if (msg && msg.type === 'run:control') {
      const action = msg.action;
      const project = msg.project || activeProjectId;
      let s = loadState();
      s.runState = s.runState || 'idle';
      
      if (action === 'play') {
        s.runState = 'running';
        startRunSession(project);
        logEvent({ type: 'RUN_STARTED', project });
      }
      if (action === 'pause') {
        s.runState = 'paused';
      }
      if (action === 'stop') {
        s.runState = 'stopped';
        stopRunSession(project, 'manual_stop');
      }
      
      saveState(s);
      // notify clients
      wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'runState:updated', runState: s.runState })); });
      // if play, start processing next task for this ws
      if (action === 'play') {
        (async function processNextTask() {
          try {
            // Check budget before starting
            const state = loadState();
                        const budgetCheck = checkBudgetExceeded(project);
            if (budgetCheck.exceeded) {
              console.log('[autopilot] budget exceeded (pre-start)', project, budgetCheck.spent, budgetCheck.budget);
              const s2 = loadState(); s2.runState = 'paused_budget'; saveState(s2);
              for (const c of wss.clients) {
                if (c.readyState !== 1) continue;
                c.send(JSON.stringify({ type: 'cost:budgetExceeded', project, spent: budgetCheck.spent, budget: budgetCheck.budget, reason: budgetCheck.reason }));
                c.send(JSON.stringify({ type: 'runState:updated', runState: 'paused_budget' }));
              }
              logEvent({ ts: new Date().toISOString(), type: 'BUDGET_EXCEEDED', project, spent: budgetCheck.spent, budget: budgetCheck.budget, reason: budgetCheck.reason });
              return;
            }


            const plan = loadPlan(project);
            const todo = (plan.tasks || []).find(t => !t.status || t.status === 'todo');
            if (!todo) {
              // nothing to do
              stopRunSession(project, 'completed');
              return;
            }
            // mark doing
            todo.status = 'doing';
            savePlan(project, plan);
            wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
            
            logEvent({ type: 'TASK_STARTED', project, taskId: todo.id, taskTitle: todo.title });

            // check for candidate bash in task fields before asking engineer
            const candidate = getTaskCandidateBash(todo);
            if (candidate) {
              const danger = isDangerousBash(candidate, project);
              logEvent({ type: 'POLICY_EVALUATED', project, action: danger.action || (danger.danger ? 'approval' : 'allow'), code: danger.code, reason: danger.reason, command: candidate, taskId: todo.id });
              if (danger.danger) {
                console.log('[autopilot] requiresApproval', project, todo.id || todo.title, candidate, danger.reason);
                s = loadState(); s.runState = 'paused'; saveState(s);
                pendingApprovals.set(project, { project, taskId: todo.id || todo.title, bash: candidate, dangerReason: danger.reason });
                wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'autopilot:requiresApproval', project, taskId: todo.id || todo.title, bash: candidate, dangerReason: danger.reason })); });
                
                logEvent({ type: 'DANGER_REQUIRES_APPROVAL', project, taskId: todo.id, taskTitle: todo.title, bash: candidate, dangerReason: danger.reason, dangerCode: danger.code });
                logEvent({ type: 'POLICY_REQUIRES_APPROVAL', project, taskId: todo.id, command: candidate, code: danger.code, reason: danger.reason });
                return;
              }
            }

            // ask engineer to complete task
            const { obj, usage, raw } = await engineerAsk(todo, { project });
            if (!obj) {
              // mark blocked
              todo.status = 'blocked';
              todo.notes = (todo.notes || '') + '\nEngineer failed to produce result';
              savePlan(project, plan);
              wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
              
              logEvent({ type: 'TASK_FINISHED', project, taskId: todo.id, taskTitle: todo.title, status: 'blocked' });
              return;
            }
            const bash = typeof obj.bash === 'string' ? obj.bash.trim() : '';
            const patch = typeof obj.patch === 'string' ? obj.patch.trim() : '';
            const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
            const danger = isDangerousBash(bash, project);

            // record usage/cost
            if (usage) addCost(project, ENGINEER_MODEL, usage);

            const engResult = { ok: true, requiresApproval: danger.danger, dangerReason: danger.reason, bash, patch, summary, raw };
            // send engineer:result to clients
            wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'engineer:result', ...engResult })); });

            logEvent({ type: 'COMMAND_PROPOSED', project, taskId: todo.id, taskTitle: todo.title, bash, summary });
            logEvent({ type: 'POLICY_EVALUATED', project, taskId: todo.id, command: bash, action: danger.action || (danger.danger ? 'approval' : 'allow'), code: danger.code, reason: danger.reason });

            if (danger.danger) {
              // pause autopilot and notify
              console.log('[autopilot] requiresApproval', project, todo.id || todo.title, bash, danger.reason);
              s = loadState(); s.runState = 'paused'; saveState(s);
              pendingApprovals.set(project, { project, taskId: todo.id || todo.title, bash, dangerReason: danger.reason });
              wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'autopilot:requiresApproval', project, taskId: todo.id || todo.title, bash, dangerReason: danger.reason })); });
              
              logEvent({ type: 'DANGER_REQUIRES_APPROVAL', project, taskId: todo.id, taskTitle: todo.title, bash, dangerReason: danger.reason, dangerCode: danger.code });
              logEvent({ type: 'POLICY_REQUIRES_APPROVAL', project, taskId: todo.id, command: bash, code: danger.code, reason: danger.reason });
              return;
            }

            // execute bash in term
            let commandId = null;
            let hb = null;
            const stall = getStallWatchdog();
            if (bash) {
              commandId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

              // Start heartbeat to emit progress and feed stall watchdog
              try {
                hb = new CommandHeartbeat(Number(process.env.HEARTBEAT_THRESHOLD_MS) || 8000, Number(process.env.HEARTBEAT_INTERVAL_MS) || 5000);
                hb.start(() => {
                  // record progress in runlog and stall watchdog
                  logEvent({ type: 'COMMAND_PROGRESS', project, taskId: todo.id, commandId, message: 'heartbeat' });
                  try { stall.recordProgress(commandId); } catch(e) {}
                  // broadcast to clients
                  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'command:progress', project, taskId: todo.id, commandId })); });
                });
              } catch (e) {}

              // Start stall watchdog
              stall.startWatching(commandId, {
                onStall: (info) => {
                  // emit WS message and runlog event once per command
                  const payload = {
                    project,
                    runSessionId: getCurrentRunSessionId(project),
                    taskId: todo.id,
                    commandId: info.commandId || commandId,
                    elapsedMs: info.elapsedMs,
                    lastProgressAt: info.lastProgressAt,
                    hint: info.hint
                  };
                  // WS
                  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'command:stall', ...payload })); });
                  // runlog
                  logEvent({ type: 'COMMAND_STALL', severity: 'warn', ...payload });
                }
              });

              // write to terminal
              term.write(bash + '\r');
              logEvent({ type: 'COMMAND_EXECUTED', project, taskId: todo.id, taskTitle: todo.title, bash, commandId, stdout: '(executing)' });
            }

            // small wait to allow output to appear
            await new Promise(r => setTimeout(r, 800));

            // ask PM to verify completion
            const { obj: pmObj, usage: pmUsage } = await pmVerify(todo, summary, bash);
            if (pmUsage) addCost(project, PM_MODEL, pmUsage);
            let done = false;
            if (pmObj && typeof pmObj.done === 'boolean') done = pmObj.done;

            // Stop heartbeat and watchdog for this command if present
            try {
              if (hb && typeof hb.stop === 'function') hb.stop();
              if (commandId) {
                try { stall.clearStall(commandId); } catch (e) {}
                try { stall.stopWatching(commandId); } catch (e) {}
              }
            } catch (e) {}

            if (done) {
              todo.status = 'done';
              todo.notes = (todo.notes || '') + '\n' + (pmObj?.notes || 'Completed');
              savePlan(project, plan);
              wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
              
              logEvent({ type: 'TASK_FINISHED', project, taskId: todo.id, taskTitle: todo.title, status: 'done' });

              // Run auto-verify recipes (project-specific or defaults)
              try {
                const projCfg = PROJECTS.map.get(project) || {};
                const repoRoot = projCfg.cwd || process.cwd();
                const verifyCmds = detectVerifyCmds(repoRoot, projCfg);
                if (verifyCmds && verifyCmds.length > 0) {
                  const verifyResult = await runVerification(verifyCmds, repoRoot, project, getCurrentRunSessionId(project));
                  // Cleanup old artifacts after verify
                  try { cleanupArtifacts(); } catch (e) {}
                  // Emit WS and runlog
                  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'verify:result', project, runSessionId: getCurrentRunSessionId(project), verifyResult })); });
                  logEvent({ type: 'VERIFY_RESULT', project, runSessionId: getCurrentRunSessionId(project), verifyResult });
                  // Log artifact entries for runlog
                  try {
                    const artifacts = verifyResult.artifacts || [];
                    for (const a of artifacts) {
                      logEvent({ type: 'VERIFY_ARTIFACT', project, runSessionId: getCurrentRunSessionId(project), artifact: a });
                    }
                  } catch (e) {}
                }
              } catch (e) {
                console.error('auto-verify error', e);
              }

              // continue to next if still running
              const newState = loadState();
              if (newState.runState === 'running') {
                // small delay then process next
                setTimeout(processNextTask, 300);
              }
            } else {
              todo.status = 'blocked';
              todo.notes = (todo.notes || '') + '\nPM did not mark done';
              savePlan(project, plan);
              wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'plan:updated', plan })); });
              
              logEvent({ type: 'TASK_FINISHED', project, taskId: todo.id, taskTitle: todo.title, status: 'blocked' });
              // Stop watchdog/heartbeat for blocked tasks too
              try { if (hb && typeof hb.stop === 'function') hb.stop(); } catch(e) {}
              try { if (commandId) { stall.stopWatching(commandId); } } catch(e) {}
            }
          } catch (e) {
            console.error('autopilot error', e);
          }
        })();
      }
      return;
    }

    if (msg && msg.type === 'state:update') {
      const newState = msg.state || {};
      const cur = loadState();
      const merged = normalizeState(Object.assign({}, cur, newState));
      const ok = saveState(merged);
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'state:updated', state: merged, ok }));
      return;
    }

    // ---- PM stall decision (continue | abort | pause) ----
    if (msg && msg.type === 'pm:stall_decision') {
      const project = msg.project || activeProjectId;
      const commandId = msg.commandId;
      const action = msg.action;
      const sd = getStallWatchdog();

      if (!commandId || !action) {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'pm:stall_decision:result', ok: false, error: 'missing commandId or action' }));
        return;
      }

      // Decision handling
      if (action === 'continue') {
        try { sd.clearStall(commandId); } catch (e) {}
        // If paused due to stall, resume runState
        const scont = loadState();
        if (scont.runState === 'paused_stall') { scont.runState = 'running'; saveState(scont); wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'runState:updated', runState: 'running' })); }); }
        logEvent({ type: 'STALL_DECISION', project, commandId, action: 'continue' });
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'pm:stall_decision:result', ok: true, action: 'continue', commandId }));
        return;
      }

      if (action === 'abort') {
        // attempt to send Ctrl-C to the project's terminal
        try {
          const t = projectTerm.get(project);
          if (t) t.write('\x03');
        } catch (e) {}
        // mark run state paused_stall
        const s = loadState(); s.runState = 'paused_stall'; saveState(s);
        wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'runState:updated', runState: 'paused_stall' })); });
        logEvent({ type: 'STALL_DECISION', project, commandId, action: 'abort' });
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'pm:stall_decision:result', ok: true, action: 'abort', commandId }));
        return;
      }

      if (action === 'retry') {
        try { sd.clearStall(commandId); } catch (e) {}
        const s3 = loadState(); if (s3.runState === 'paused_stall') { s3.runState = 'running'; saveState(s3); wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'runState:updated', runState: 'running' })); }); }
        logEvent({ type: 'STALL_DECISION', project, commandId, action: 'retry' });
        // trigger a retry of processing tasks for this project
        setTimeout(() => { try { processNextTask(project); } catch (e) {} }, 300);
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'pm:stall_decision:result', ok: true, action: 'retry', commandId }));
        return;
      }

      if (action === 'pause') {
        const s2 = loadState(); s2.runState = 'paused_stall'; saveState(s2);
        wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'runState:updated', runState: 'paused_stall' })); });
        logEvent({ type: 'STALL_DECISION', project, commandId, action: 'pause' });
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'pm:stall_decision:result', ok: true, action: 'pause', commandId }));
        return;
      }

      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'pm:stall_decision:result', ok: false, error: 'unknown action' }));
      return;
    }

    // ---------------- Engineer API ----------------
    if (msg && msg.type === 'engineer:ask') {
      if (!isSmoke() && !hasKey) {
        ws.send(JSON.stringify({ type: 'engineer:result', ok: false, error: 'OPENAI_API_KEY missing' }));
        return;
      }

      const prompt = msg.prompt || msg.text || '';
      const project = msg.project || msg.projectId || activeProjectId || 'default';

      const userText = [
        `Project: ${project}`,
        `Request: ${prompt}`,
        `State: ${JSON.stringify(loadState())}`,
      ].join('\n');

      try {
        // Create a minimal task object for engineerAsk
        const task = { title: prompt, notes: `State: ${JSON.stringify(loadState())}` };
        const { obj, usage, raw: rawText } = await engineerAsk(task, { project });
        if (!obj) {
          ws.send(JSON.stringify({ type: 'engineer:result', ok: false, raw: rawText }));
          return;
        }

        const bash = typeof obj.bash === 'string' ? obj.bash.trim() : '';
        const patch = typeof obj.patch === 'string' ? obj.patch.trim() : '';
        const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
        const danger = isDangerousBash(bash);

        const payload = {
          ok: true,
          requiresApproval: danger.danger,
          dangerReason: danger.reason,
          bash,
          patch,
          summary,
          raw: rawText,
        };

        const store = addUsage(project, ENGINEER_MODEL, usage);
        ws.send(JSON.stringify({ type: 'engineer:result', ...payload }));
        ws.send(JSON.stringify({ type: 'usage:summary', summary: summarizeUsage(project), totals: store.totals }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'engineer:result', ok: false, error: String(e?.message || e) }));
      }
      return;
    }

    // ---------------- PM API ----------------
    if (msg && msg.type === 'pm:ask') {
      if (!isSmoke() && !hasKey) {
        ws.send(JSON.stringify({ type: 'pm:result', ok: false, error: 'OPENAI_API_KEY missing' }));
        return;
      }
      const prompt = msg.prompt || msg.text || '';
      const project = msg.project || msg.projectId || activeProjectId || 'default';

      const userText = [
        `Project: ${project}`,
        `Request: ${prompt}`,
        `Current state: ${JSON.stringify(loadState())}`,
      ].join('\n');

      try {
        const { obj, usage, raw: rawText } = await callJSON(PM_MODEL, PM_SYSTEM_PROMPT, userText, 'PMUpdate');
        if (!obj) {
          ws.send(JSON.stringify({ type: 'pm:result', ok: false, raw: rawText }));
          return;
        }

        const state = normalizeState(obj.state || obj);
        const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';

        saveState(state);
        const store = addUsage(project, PM_MODEL, usage);
        addCost(project, PM_MODEL, usage);
        ws.send(JSON.stringify({ type: 'pm:result', ok: true, state, summary, raw: rawText }));
        broadcastState(state);
        ws.send(JSON.stringify({ type: 'usage:summary', summary: summarizeUsage(project), totals: store.totals }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'pm:result', ok: false, error: String(e?.message || e) }));
      }
      return;
    }

    // execute arbitrary command from UI (Test/Deploy)
    if (msg && msg.type === 'cmd:exec') {
      const project = msg.project || activeProjectId;
      const cmd = msg.cmd || '';
      if (cmd && term) {
        term.write(cmd + '\r');
        // relay ack
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'cmd:exec:ok', cmd }));
      }
      return;
    }

    // ---- V4.2: Context Pack ----
    if (msg && msg.type === 'pm:context_sync') {
      const project = msg.project || activeProjectId;
      const repoRoot = PROJECTS.map.get(project)?.cwd || process.cwd();
      
      try {
        const snapshot = await createContextSnapshot(repoRoot, {
          includeGlobs: msg.includeGlobs,
          excludeGlobs: msg.excludeGlobs,
          maxFiles: msg.maxFiles,
          maxBytes: msg.maxBytes
        });
        
        // Store as runlog event
        logEvent({
          ...snapshot,
          project
        });
        
        // Broadcast to clients
        wss.clients.forEach((c) => {
          if (c.readyState === 1) {
            c.send(JSON.stringify({
              type: 'context:snapshot',
              project,
              snapshot
            }));
          }
        });
        
        // Auto-trigger summary update
        await triggerSummaryUpdate(project);
        
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'pm:context_sync:result',
            ok: true,
            stats: snapshot.stats
          }));
        }
      } catch (err) {
        console.error('context_sync error:', err);
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'pm:context_sync:result',
            ok: false,
            error: String(err.message || err)
          }));
        }
      }
      return;
    }

    // ---- V4.2: Summary Update ----
    if (msg && msg.type === 'pm:summary_update') {
      const project = msg.project || activeProjectId;
      
      try {
        const summaryText = await buildProjectSummary(project);
        const updatedAt = new Date().toISOString();
        
        sessionSummaries.set(project, { summaryText, updatedAt });
        
        // Broadcast to clients
        wss.clients.forEach((c) => {
          if (c.readyState === 1) {
            c.send(JSON.stringify({
              type: 'summary:updated',
              project,
              runSessionId: getCurrentRunSessionId(project),
              summaryText,
              updatedAt
            }));
          }
        });
        
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'pm:summary_update:result',
            ok: true,
            summaryText
          }));
        }
      } catch (err) {
        console.error('summary_update error:', err);
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'pm:summary_update:result',
            ok: false,
            error: String(err.message || err)
          }));
        }
      }
      return;
    }

    // ---- V4.2: Clear Engineer Context ----
    if (msg && msg.type === 'pm:clear_engineer') {
      const project = msg.project || activeProjectId;
      
      // Clear engineer context buffer
      engineerContexts.delete(project);
      
      // Log event
      logEvent({
        type: 'ENGINEER_CLEARED',
        project,
        ts: new Date().toISOString()
      });
      
      // Broadcast to clients
      wss.clients.forEach((c) => {
        if (c.readyState === 1) {
          c.send(JSON.stringify({
            type: 'engineer:cleared',
            project
          }));
        }
      });
      
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'pm:clear_engineer:result',
          ok: true
        }));
      }
      return;
    }
  });

  ws.on('close', () => {
    if (sub && typeof sub.dispose === 'function') sub.dispose();
    if (term && typeof term.kill === 'function') term.kill();
  });
});

// Handle port conflicts: robust retry PORT..PORT_END (default 8788-8799)
// Goal: never crash on EADDRINUSE; always print LISTENING_PORT=<port> on success.
function listenOnce(port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    const onListening = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      server.off('error', onError);
      server.off('listening', onListening);
    };

    // Attach handlers BEFORE listen() to avoid "Unhandled 'error' event"
    server.once('error', onError);
    server.once('listening', onListening);

    server.listen(port, '0.0.0.0');
  }).then(() => {
    const addr = server.address && server.address();
    if (addr && typeof addr === 'object' && addr.port) return addr.port;
    return port;
  });
}

async function startServerWithRetry() {
  // Initialize cloud storage
  await initializeStorage({
    type: process.env.STORAGE_TYPE || 'local',
    bucket: process.env.STORAGE_BUCKET || 'agent-dashboard',
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION || 'us-east-1',
    enabled: process.env.STORAGE_ENABLED !== 'false'
  });

  const loRaw = Number(process.env.PORT || 8788);
  const hiRaw = Number(process.env.PORT_END || 8799);

  const lo = Number.isFinite(loRaw) ? loRaw : 8788;
  const hi = Number.isFinite(hiRaw) ? hiRaw : 8799;
  const end = Math.max(lo, hi);

  for (let port = lo; port <= end; port++) {
    try {
      const actual = await listenOnce(port);
      console.log(`Agent dashboard running on http://localhost:${actual}`);
      console.log(`LISTENING_PORT=${actual}`);
      return actual;
    } catch (err) {
      
      // In JS runtime we'll check err.code below; this line is inert in template
      if (err && err.code === 'EADDRINUSE') {
        // try next port
        continue;
      }
      console.error('Server error:', err);
      throw err;
    }
  }
  throw new Error(`EADDRINUSE: no free port in range ${lo}-${end}`);
}

startServerWithRetry().catch((err) => {
  console.error('Fatal: failed to start server:', err);
  process.exit(1);
});
