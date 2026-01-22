import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import {
  ProjectList,
  ProjectDetail,
  DangerCommandApprovalPrompt,
  AuditLog
} from "./components/ProjectUI.jsx";
import "./styles/project-ui.css";
import "./styles/queue-policy.css";

// UI guard: never call .map on non-array
const asArray = (v) => (Array.isArray(v) ? v : []);

function safeStringify(x) {
  try {
    if (typeof x === "string") return x;
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

async function fetchProjects() {
  // 走 server.mjs 新增的 endpoint
  const r = await fetch("/api/projects");
  if (!r.ok) throw new Error(`projects http ${r.status}`);
  const j = await r.json();
  if (Array.isArray(j)) return j;
  if (j?.ok === false) throw new Error(j.error || "projects not ok");
  if (Array.isArray(j?.projects)) return j.projects;
  if (Array.isArray(j?.list)) return j.list;
  return [];
}

function App() {
  const termRef = useRef(null);
  const term = useMemo(() => new Terminal({ convertEol: true, fontSize: 12 }), []);
  const [ws, setWs] = useState(null);
  // loading state (avoid white-screen if referenced)
  const [engineerLoading, setEngineerLoading] = useState(false);


  const [pmLoading, setPmLoading] = useState(false);
  const [wsError, setWsError] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [progress, setProgress] = useState({ total: 28, current: "DB-3 爬蟲搭建", currentPct: 35 });
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' or 'projects'
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);

  // Engineer
  const [engineerPrompt, setEngineerPrompt] = useState("列出這個資料夾有哪些檔案（bash）");
  const [engineerOut, setEngineerOut] = useState("");
  const [engineerBusy, setEngineerBusy] = useState(false);
  const [engineerResult, setEngineerResult] = useState(null);
  const [dangerAck, setDangerAck] = useState(false);

  // PM
  const [pmPrompt, setPmPrompt] = useState("把目前進度設定成：總體 28%，目前 DB-3 爬蟲搭建 35%");
  const [pmOut, setPmOut] = useState("");
  const [pmBusy, setPmBusy] = useState(false);
  const [plan, setPlan] = useState({ projectId: '', tasks: [] });
  const [runState, setRunState] = useState('idle');
  const [cost, setCost] = useState({});
  const [pendingApproval, setPendingApproval] = useState(null);
  const [approvalAck, setApprovalAck] = useState(false);
  const [budget, setBudget] = useState(null); // USD
  const [projectsConfig, setProjectsConfig] = useState([]);
  const [runEvents, setRunEvents] = useState([]);
  const [runSessions, setRunSessions] = useState([]);
  const [selectedRunSession, setSelectedRunSession] = useState('');
  const [sessionSummary, setSessionSummary] = useState('');
  const [commandProgress, setCommandProgress] = useState(null);

  // load projects
  useEffect(() => {
    fetchProjects()
      .then((arr) => {
        setProjects(arr);
        if (arr.length && !projectId) setProjectId(arr[0].id || arr[0].key || arr[0].name || "");
      })
      .catch((e) => {
        console.error(e);
      });
  }, []);

  // notify server when project changes
  useEffect(() => {
    if (ws && ws.readyState === 1 && projectId) {
      ws.send(JSON.stringify({ type: 'project:set', project: projectId }));
    }
  }, [projectId, ws]);

  // load run sessions when project changes
  useEffect(() => {
    if (!projectId) {
      setRunSessions([]);
      setSelectedRunSession('');
      return;
    }
    
    fetch(`/api/runs?project=${encodeURIComponent(projectId)}`)
      .then(res => res.json())
      .then(sessions => {
        setRunSessions(sessions);
        // Auto-select latest session
        if (sessions.length > 0) {
          setSelectedRunSession(sessions[0].runSessionId);
        } else {
          setSelectedRunSession('');
        }
      })
      .catch(err => {
        console.error('Failed to load run sessions:', err);
        setRunSessions([]);
        setSelectedRunSession('');
      });
  }, [projectId]);

  useEffect(() => {
    term.open(termRef.current);
    term.write("Connecting...\r\n");

    const socket = new WebSocket(`ws://${location.host}`);

    socket.onopen = () => {
      term.write("WS connected\r\n");
      socket.send(JSON.stringify({ type: 'state:get' }));
      if (projectId) socket.send(JSON.stringify({ type: 'project:set', project: projectId }));
    };

    socket.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        console.error("WS parse error:", e, ev.data);
        return;
      }

      try {
        // keep header progress in sync with backend pushes
        if (msg.type === "pm:result" && msg.state) setProgress(msg.state);
        if (msg.type === "state:updated" && msg.state) setProgress(msg.state);

        if (msg.type === "term:data") {
          term.write(msg.data);
          return;
        }

        if (msg.type === "runlog:event") {
          setRunEvents((prev) => [...prev, msg.event].slice(-100)); // Keep last 100 events
          return;
        }

        if (msg.type === "engineer:result") {
          setEngineerBusy(false);
          setEngineerLoading(false);
          setDangerAck(false);
          if (!msg.ok) {
            setEngineerOut(`ERROR: ${msg.error || "parse failed"}\n${msg.raw ? safeStringify(msg.raw) : ""}`);
            setEngineerResult(null);
          } else {
            setEngineerResult(msg);
            setEngineerOut(safeStringify({ bash: msg.bash, patch: msg.patch, summary: msg.summary, requiresApproval: msg.requiresApproval, dangerReason: msg.dangerReason }));
          }
          return;
        }

        if (msg.type === 'plan:updated') {
          setPlan(msg.plan || { projectId: projectId, tasks: [] });
          // update header from plan
          const tasks = (msg.plan?.tasks || []);
          const totalPoints = tasks.reduce((s, t) => s + (Number(t.points) || 0), 0) || 1;
          const donePoints = tasks.reduce((s, t) => s + ((t.status === 'done') ? (Number(t.points) || 0) : 0), 0);
          const doing = tasks.find(t => t.status === 'doing') || tasks.find(t => t.status === 'todo');
          const currentPct = doing ? (doing.progress ?? 0) : 0;
          const sstate = { total: Math.round((donePoints / totalPoints) * 100), current: doing?.title || '', currentPct };
          setProgress(sstate);
          // persist via server
          if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'state:update', state: { total: sstate.total, current: sstate.current, currentPct: sstate.currentPct, project: projectId } }));
          return;
        }

        if (msg.type === 'cost:updated') {
          setCost(msg.cost || {});
          return;
        }

        if (msg.type === 'cost:budgetExceeded') {
          alert(`Budget exceeded!\nSpent: ${msg.spent?.toFixed(2) || 0} TWD\nBudget: ${msg.budget?.toFixed(2) || 0} TWD`);
          setRunState('paused_budget');
          return;
        }

        if (msg.type === 'runState:updated') {
          setRunState(msg.runState || 'idle');
          return;
        }

        if (msg.type === 'pm:plan_create:result') {
          if (msg.ok && msg.plan) {
            setPlan(msg.plan || { projectId: projectId, tasks: [] });
          } else {
            setPmOut(`ERROR: ${msg.error || 'plan create failed'}\n${msg.raw || ''}`);
          }
          return;
        }

        if (msg.type === 'autopilot:approve:result') {
          if (msg.ok) setPendingApproval(null);
          return;
        }

        if (msg.type === 'autopilot:requiresApproval') {
          // show pending approval panel
          setPendingApproval({ project: msg.project, taskId: msg.taskId, bash: msg.bash, dangerReason: msg.dangerReason });
          setApprovalAck(false);
          setRunState('paused');
          // Record approval event for audit log
          const auditEvent = {
            type: 'POLICY_REQUIRES_APPROVAL',
            ts: new Date().toISOString(),
            command: msg.bash || '',
            reason: msg.dangerReason || 'Dangerous command detected',
            severity: msg.severity || 'high',
            project: msg.project || projectId
          };
          setAuditEvents(prev => [...prev, auditEvent].slice(-100));
          return;
        }

        // V4.2: Summary updated
        if (msg.type === 'summary:updated') {
          setSessionSummary(msg.summaryText || '');
          return;
        }

        // V4.2: Command progress heartbeat
        if (msg.type === 'command:progress') {
          setCommandProgress(msg);
          return;
        }

        // V4.2: Engineer cleared
        if (msg.type === 'engineer:cleared') {
          term.write('\r\n[Engineer context cleared]\r\n');
          return;
        }

        if (msg.type === 'project:list') {
          const list = Array.isArray(msg.projects) ? msg.projects : [];
          setProjects(list);
          if (msg.activeProject) setProjectId(msg.activeProject);
          return;
        }

        if (msg.type === "pm:result") {
          setPmBusy(false);
          setPmLoading(false);
          if (!msg.ok) {
            setPmOut(`ERROR: ${msg.error || "parse failed"}\n${msg.raw ? safeStringify(msg.raw) : ""}`);
          } else {
            setPmOut(safeStringify({ state: msg.state, summary: msg.summary }));
            if (msg.state) {
              const s = msg.state;
              setProgress({
                total: Number(s.total) || 0,
                current: s.current || progress.current,
                currentPct: Number(s.currentPct) || 0,
              });
              // persist via server
              if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'state:update', state: s }));
            }
          }
          return;
        }

        if (msg.type === 'state:updated') {
          const s = msg.state || {};
          setProgress((p) => ({
            total: Number.isFinite(Number(s.total)) ? Number(s.total) : p.total,
            current: s.current || s.current?.label || p.current,
            currentPct: Number.isFinite(Number(s.currentPct ?? s.current?.pct)) ? Number(s.currentPct ?? s.current?.pct) : p.currentPct,
            budget: s.budget ?? p.budget,
          }));
          if (s.project) setProjectId(s.project);
          if (s.budget != null) setBudget(s.budget);
          if (s.runState) setRunState(s.runState);
          return;
        }
      } catch (e) {
        console.error("UI handler error:", e);
        term.write(`\r\n[UI handler error] ${String(e?.message || e)}\r\n`);
      }
    };

    socket.onopen = () => {
      setWsError("");
      term.write("WS connected\r\n");
    };
    socket.onerror = () => setWsError("WebSocket error. Please refresh.");
    socket.onclose = () => {
      setWsError("WebSocket closed. Please refresh.");
      term.write("\r\nWS closed\r\n");
    };
    setWs(socket);

    term.onData((data) => {
      if (socket.readyState === 1) socket.send(JSON.stringify({ type: "term:write", data }));
    });

    return () => socket.close();
  }, []);

  const runEngineer = () => {
    setEngineerLoading(true);
    if (!ws || ws.readyState !== 1) {
      setEngineerLoading(false);
      setEngineerOut("ERROR: WebSocket not connected.");
      return;
    }
    setEngineerBusy(true);
    setEngineerOut("");
    setEngineerResult(null);
    setDangerAck(false);
    ws.send(JSON.stringify({ type: "engineer:ask", project: projectId, prompt: engineerPrompt }));
  };

  const runSuggested = () => {
    if (!ws || ws.readyState !== 1) return;
    if (!engineerResult || !engineerResult.bash) return;
    if (engineerResult.requiresApproval && !dangerAck) return;
    const cmd = `${engineerResult.bash}\r`;
    ws.send(JSON.stringify({ type: 'term:write', data: cmd }));
  };

  const engineerButtonLabel = engineerResult?.bash
    ? (engineerResult?.requiresApproval ? "Approve & Run" : "Run Suggested")
    : (engineerLoading ? "Generating…" : "Ask Engineer");

  const engineerButtonDisabled = engineerResult?.bash
    ? (engineerResult.requiresApproval && !dangerAck)
    : engineerBusy;

  const askPM = () => {
    setPmLoading(true);
    if (!ws || ws.readyState !== 1) {
      setPmLoading(false);
      setPmOut("ERROR: WebSocket not connected.");
      return;
    }
    setPmBusy(true);
    setPmOut("");
    ws.send(JSON.stringify({ type: "pm:ask", project: projectId, prompt: pmPrompt, state: progress }));
  };

  const updateState = () => {
    if (!ws || ws.readyState !== 1) {
      setPmOut('ERROR: WebSocket not connected.');
      return;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(pmOut);
    } catch (e) {
      // ignore
    }

    const s = {};
    if (parsed) {
      if (parsed.totalPct != null) s.total = parsed.totalPct;
      if (parsed.total != null) s.total = parsed.total;
      if (parsed.current != null) s.current = parsed.current;
      if (parsed.currentPct != null) s.currentPct = parsed.currentPct;
      if (parsed.current && typeof parsed.current === 'object' && parsed.current.label) {
        s.current = parsed.current.label;
        if (parsed.current.pct != null) s.currentPct = parsed.current.pct;
      }
    }

    // fallback: try to find a number in pmPrompt
    if (!s.total) {
      const m = pmPrompt.match(/(\d{1,3})\s*%/);
      if (m) s.total = Number(m[1]);
    }

    if (!s.currentPct) {
      const m2 = pmPrompt.match(/目前[^\d]*(\d{1,3})\s*%/);
      if (m2) s.currentPct = Number(m2[1]);
    }

    if (!s.current) s.current = pmPrompt.slice(0, 60);

    ws.send(JSON.stringify({ type: 'state:update', state: s }));
  };

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateRows: "56px 1fr", background: "#0b0f14", color: "#e6edf3" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid #1f2a37", gap: 12 }}>
        <div style={{ fontWeight: 700 }}>Shipyard Community</div>
        
        <div style={{ display: "flex", gap: 4, marginLeft: 16 }}>
          <button
            onClick={() => setViewMode('dashboard')}
            style={{
              padding: "6px 12px",
              background: viewMode === 'dashboard' ? "#238636" : "#1f2a37",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: viewMode === 'dashboard' ? 600 : 500
            }}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setViewMode('projects')}
            style={{
              padding: "6px 12px",
              background: viewMode === 'projects' ? "#238636" : "#1f2a37",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: viewMode === 'projects' ? 600 : 500
            }}
          >
            📁 Multi-Project
          </button>
        </div>

        {wsError ? (
          <div style={{ background: "#7a1f1f", color: "#fff", padding: "4px 8px", borderRadius: 6, fontSize: 12 }}>
            {wsError}
          </div>
        ) : null}

        <div style={{ opacity: 0.9 }}>
          總體進度：{progress.total}%　｜　目前進行：{progress.current} {progress.currentPct}%
        </div>

        <div style={{ marginLeft: 16, fontSize: 12, opacity: 0.85 }}>
          Cost: {cost.total?.calls || 0} calls, {cost.total?.total_tokens || 0} tokens, ~{(cost.total?.estimated_twd || 0).toFixed(2)} TWD
        </div>

        <div style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Budget (TWD)</span>
          <input
            type="number"
            value={budget ?? progress.budget ?? 100}
            onChange={(e) => {
              const val = Number(e.target.value);
              setBudget(val);
              if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'state:update', state: { budget: val } }));
              }
            }}
            style={{ width: 80, background: "#0b0f14", color: "#e6edf3", border: "1px solid #1f2a37", borderRadius: 8, padding: "6px 8px" }}
          />
        </div>

        {cost && cost.cost_twd ? (
          <div style={{ opacity: 0.8, fontSize: 12 }}>
            💰 已用：{(cost.cost_twd || 0).toFixed(2)} TWD / {(cost.cost_usd || 0).toFixed(4)} USD
            {budget ? ` (預算: ${budget} USD)` : ''}
          </div>
        ) : null}

        <div style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Project</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={{ background: "#0b0f14", color: "#e6edf3", border: "1px solid #1f2a37", borderRadius: 8, padding: "6px 8px" }}
          >
            {projects.length ? null : <option value="">(no projects)</option>}
            {asArray(projects).map((p) => {
              const id = p.id || p.key || p.name;
              const label = p.label || p.name || p.title || id;
              return (
                <option key={id} value={id}>
                  {label}
                </option>
              );
            })}
          </select>
          <button
            onClick={() => {
              setProjectId('demo-project');
              // Load demo plan if not exists
              if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'project:set', project: 'demo-project' }));
                ws.send(JSON.stringify({ type: 'pm:plan_create', project: 'demo-project', prompt: 'Create a simple plan for demo-project: run tests, deploy' }));
              }
            }}
            style={{ padding: "6px 12px", background: "#238636", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
          >
            🎯 Load Demo
          </button>
        </div>

        <div style={{ marginLeft: "auto", opacity: 0.7, fontSize: 12 }}>
          {engineerBusy ? "Engineer generating…" : ""}{engineerBusy && pmBusy ? " | " : ""}{pmBusy ? "PM generating…" : ""}
        </div>
      </div>

      {/* Multi-Project View */}
      {viewMode === 'projects' ? (
        <div style={{ padding: 16, overflow: 'auto', background: '#0b0f14' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, height: 'calc(100vh - 100px)' }}>
            {/* Project List Sidebar */}
            <div style={{ overflow: 'auto' }}>
              <ProjectList
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={(pid) => {
                  setSelectedProjectId(pid);
                  setProjectId(pid);
                }}
              />
            </div>

            {/* Project Detail */}
            {selectedProjectId ? (
              <div style={{ overflow: 'auto' }}>
                <ProjectDetail projectId={selectedProjectId} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 8 }}>📁 Select a project to view details</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Click a project from the list on the left</div>
                </div>
              </div>
            )}
          </div>

          {/* Approval Prompt Modal */}
          {pendingApproval && (
            <DangerCommandApprovalPrompt
              taskId={pendingApproval.taskId}
              command={pendingApproval.bash}
              reason={pendingApproval.dangerReason}
              severity="high"
              onApprove={() => {
                if (ws && ws.readyState === 1) {
                  ws.send(JSON.stringify({ type: 'autopilot:approve', taskId: pendingApproval.taskId }));
                  const auditEvent = {
                    type: 'DANGER_APPROVED',
                    ts: new Date().toISOString(),
                    command: pendingApproval.bash || '',
                    reason: pendingApproval.dangerReason || '',
                    severity: 'high',
                    approver: 'user',
                    project: pendingApproval.project || projectId
                  };
                  setAuditEvents(prev => [...prev, auditEvent]);
                }
              }}
              onReject={() => {
                if (ws && ws.readyState === 1) {
                  ws.send(JSON.stringify({ type: 'autopilot:reject', taskId: pendingApproval.taskId }));
                  const auditEvent = {
                    type: 'DANGER_REJECTED',
                    ts: new Date().toISOString(),
                    command: pendingApproval.bash || '',
                    reason: pendingApproval.dangerReason || '',
                    severity: 'high',
                    approver: 'user',
                    project: pendingApproval.project || projectId
                  };
                  setAuditEvents(prev => [...prev, auditEvent]);
                }
                setPendingApproval(null);
              }}
              isProcessing={false}
            />
          )}

          {/* Audit Log */}
          {auditEvents.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <AuditLog events={auditEvents} />
            </div>
          )}
        </div>
      ) : (
        /* Original Dashboard View */
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gridTemplateRows: "1fr 1fr", gap: 12, padding: 12 }}>
        {/* Terminal */}
        <div style={{ gridRow: "1 / span 2", border: "1px solid #1f2a37", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 10, borderBottom: "1px solid #1f2a37", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <span>Terminal (WSL)</span>
            {commandProgress && (
              <span style={{ fontSize: 11, color: '#f5a623', opacity: 0.9 }}>
                ⏱ Running... {Math.floor(commandProgress.elapsed_ms / 1000)}s
              </span>
            )}
          </div>
          <div ref={termRef} style={{ height: "calc(100% - 42px)" }} />
        </div>

        {/* Engineer */}
        <div style={{ border: "1px solid #1f2a37", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 10, borderBottom: "1px solid #1f2a37", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
            <span>Engineer</span>
            {engineerBusy ? <span style={{ fontSize: 12, opacity: 0.8 }}>generating…</span> : null}
          </div>

          <textarea
            id="engineerPrompt"
            name="engineerPrompt"
            value={engineerPrompt}
            onChange={(e) => setEngineerPrompt(e.target.value)}
            placeholder="描述你要 Engineer 做什麼（它會回 JSON：bash/patch）"
            style={{ height: 110, background: "#0b0f14", color: "#e6edf3", border: "none", padding: 10, outline: "none" }}
          />

          <div style={{ display: 'flex', gap: 8, padding: 10, paddingTop: 0 }}>
            <button
              onClick={() => {
                if (engineerResult?.bash) {
                  runSuggested();
                } else {
                  runEngineer();
                }
              }}
              disabled={engineerButtonDisabled}
              style={{ padding: 10, background: engineerButtonDisabled ? "#234" : "#1f6feb", color: "white", border: "none", cursor: engineerButtonDisabled ? "not-allowed" : "pointer", flex: 1 }}
            >{engineerButtonLabel}</button>
          </div>

          <div style={{ flex: 1, borderTop: "1px solid #1f2a37", padding: 10, overflow: "auto" }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Engineer result (JSON)</div>
            {engineerResult?.requiresApproval ? (
              <div style={{ background: "#3b0d0d", color: "#ffb4b4", padding: 8, borderRadius: 8, marginBottom: 8 }}>
                Danger detected: {engineerResult?.dangerReason || 'potentially harmful command'}. Review before running.
                <label style={{ display: "block", marginTop: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={dangerAck} onChange={(e) => setDangerAck(e.target.checked)} /> I understand and still want to run
                </label>
              </div>
            ) : null}

            {pendingApproval ? (
              <div style={{ background: '#3b0d0d', color: '#ffb4b4', padding: 8, borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>Autopilot paused for approval</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Task: {pendingApproval.taskId}</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Reason: {pendingApproval.dangerReason}</div>
                <pre style={{ background: '#111', padding: 8, marginTop: 8 }}>{pendingApproval.bash}</pre>
                <label style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                  <input type="checkbox" checked={approvalAck} onChange={(e) => setApprovalAck(e.target.checked)} /> I understand the risk and approve execution
                </label>
                <div style={{ marginTop: 8 }}>
                  <button disabled={!approvalAck || !ws || ws.readyState !== 1} onClick={() => {
                    if (!ws || ws.readyState !== 1) return;
                    ws.send(JSON.stringify({ type: 'autopilot:approve', project: pendingApproval.project }));
                  }} style={{ padding: 8, background: '#f5a623', color: '#000', border: 'none' }}>Approve & Continue</button>
                </div>
              </div>
            ) : null}
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{engineerOut || "(empty)"}</pre>
          </div>
        </div>

        {/* Checklist (left-bottom) */}
        <div style={{ border: "1px solid #1f2a37", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 10, borderBottom: "1px solid #1f2a37", fontWeight: 700 }}>Checklist</div>
          <div style={{ padding: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>Tasks for {projectId}</div>
            {(plan.tasks || []).map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderBottom: '1px solid #111' }}>
                <input type="checkbox" checked={t.status === 'done'} onChange={(e) => {
                  const newPlan = { ...plan, tasks: plan.tasks.map(tt => tt.id === t.id ? { ...tt, status: e.target.checked ? 'done' : 'todo' } : tt) };
                  setPlan(newPlan);
                  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'plan:update', project: projectId, plan: newPlan }));
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{t.notes || ''}</div>
                </div>
                <div style={{ width: 80, textAlign: 'right', fontSize: 12 }}>{t.points || 0} pts</div>
              </div>
            ))}
          </div>
        </div>

        {/* PM */}
        <div style={{ border: "1px solid #1f2a37", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 10, borderBottom: "1px solid #1f2a37", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
            <span>PM</span>
            {pmBusy ? <span style={{ fontSize: 12, opacity: 0.8 }}>generating…</span> : null}
          </div>

          <textarea
            id="pmPrompt"
            name="pmPrompt"
            value={pmPrompt}
            onChange={(e) => setPmPrompt(e.target.value)}
            placeholder="你對 PM 說需求/調整方向/更新進度"
            style={{ height: 110, background: "#0b0f14", color: "#e6edf3", border: "none", padding: 10, outline: "none" }}
          />

          <button
            onClick={askPM}
            disabled={pmBusy}
            style={{ padding: 10, background: pmBusy ? "#234" : "#2ea043", color: "white", border: "none", cursor: pmBusy ? "not-allowed" : "pointer" }}
          >
            {pmLoading ? "Generating…" : "Ask PM"}
          </button>
          <button
            onClick={() => {
              if (!ws || ws.readyState !== 1) return;
              setPmBusy(true);
              ws.send(JSON.stringify({ type: 'pm:plan_create', project: projectId, requirements: pmPrompt }));
            }}
            disabled={pmBusy}
            style={{ padding: 10, marginLeft: 8, background: '#007acc', color: '#fff', border: 'none', cursor: pmBusy ? 'not-allowed' : 'pointer' }}
          >Generate Plan</button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'run:control', action: 'play', project: projectId })); }}
              style={{ padding: 8, background: '#2ea043', color: '#fff', border: 'none' }}
            >Play</button>
            <button
              onClick={() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'run:control', action: 'pause', project: projectId })); }}
              style={{ padding: 8, background: '#f5a623', color: '#000', border: 'none' }}
            >Pause</button>
            <button
              onClick={() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'run:control', action: 'stop', project: projectId })); }}
              style={{ padding: 8, background: '#d9534f', color: '#fff', border: 'none' }}
            >Stop</button>
            <button
              onClick={() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'cmd:exec', project: projectId, cmd: (projects.find(p=>p.id===projectId)?.testCmd || 'echo no testCmd defined') })); }}
              style={{ padding: 8, background: '#4a90e2', color: '#fff', border: 'none' }}
            >Test</button>
            <button
              onClick={() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'cmd:exec', project: projectId, cmd: (projects.find(p=>p.id===projectId)?.deployCmd || 'echo no deployCmd defined') })); }}
              style={{ padding: 8, background: '#6a5acd', color: '#fff', border: 'none' }}
            >Deploy</button>
            <button
              onClick={() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'pm:context_sync', project: projectId })); }}
              style={{ padding: 8, background: '#0969da', color: '#fff', border: 'none', fontSize: 11 }}
              title="Sync context files and generate summary"
            >📁 Sync Context</button>
            <button
              onClick={() => { 
                if (!ws || ws.readyState !== 1) return;
                if (!confirm('Clear engineer context buffer? This resets the conversation history.')) return;
                ws.send(JSON.stringify({ type: 'pm:clear_engineer', project: projectId })); 
              }}
              style={{ padding: 8, background: '#9a6700', color: '#fff', border: 'none', fontSize: 11 }}
              title="Clear engineer context/conversation"
            >🧹 Clear Engineer</button>
            <button
              disabled={runSessions.length === 0}
              onClick={async () => {
                if (runSessions.length === 0) {
                  alert('No run sessions available. Run autopilot first.');
                  return;
                }
                
                try {
                  const params = new URLSearchParams({ project: projectId });
                  // Use selected session, or default to latest
                  const sessionToExport = selectedRunSession || (runSessions.length > 0 ? runSessions[0].runSessionId : null);
                  if (sessionToExport) {
                    params.append('runSessionId', sessionToExport);
                  }
                  
                  const res = await fetch(`/api/report?${params.toString()}`);
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    alert(`Report generation failed: ${data.error || res.statusText}`);
                    return;
                  }
                  const markdown = await res.text();
                  const blob = new Blob([markdown], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `report_${projectId}_${sessionToExport || 'all'}_${Date.now()}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  alert('Export failed: ' + e.message);
                }
              }}
              style={{ 
                padding: 8, 
                background: runSessions.length === 0 ? '#666' : '#8b5cf6', 
                color: '#fff', 
                border: 'none', 
                cursor: runSessions.length === 0 ? 'not-allowed' : 'pointer',
                opacity: runSessions.length === 0 ? 0.6 : 1
              }}
            >📊 Export Report</button>
          </div>
          {projects.find(p => p.id === projectId)?.previewUrl ? (
            <div style={{ padding: 10, borderTop: '1px solid #1f2a37', fontSize: 12 }}>
              Preview: <a href={projects.find(p => p.id === projectId)?.previewUrl} target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>{projects.find(p => p.id === projectId)?.previewUrl}</a>
            </div>
          ) : null}

          <div style={{ flex: 1, borderTop: "1px solid #1f2a37", padding: 10, overflow: "auto", display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessionSummary && (
              <details open style={{ fontSize: 12, background: '#1c2128', padding: 8, borderRadius: 6 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#58a6ff', marginBottom: 8 }}>
                  📝 Session Summary
                </summary>
                <div style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {sessionSummary}
                </div>
              </details>
            )}
            
            <details style={{ fontSize: 12 }}>
              <summary style={{ cursor: 'pointer', opacity: 0.8, marginBottom: 6 }}>PM result (JSON)</summary>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 6 }}>{pmOut || "(empty)"}</pre>
            </details>
            
            <details style={{ fontSize: 12 }}>
              <summary style={{ cursor: 'pointer', opacity: 0.8, marginBottom: 6 }}>
                Run Log ({runEvents.length} events)
              </summary>
              {runSessions.length === 0 ? (
                <div style={{ marginTop: 6, opacity: 0.6, fontSize: 11 }}>
                  No run sessions yet. Click <strong>▶ Play</strong> to start autopilot.
                </div>
              ) : (
                <>
                  <div style={{ marginTop: 6, marginBottom: 6 }}>
                    <label style={{ fontSize: 11, opacity: 0.8, marginRight: 6 }}>Session:</label>
                    <select 
                      value={selectedRunSession} 
                      onChange={(e) => setSelectedRunSession(e.target.value)}
                      style={{ background: '#1c2128', color: '#adbac7', border: '1px solid #444c56', padding: 2, fontSize: 11 }}
                    >
                      <option value="">All</option>
                      {runSessions.map(s => (
                        <option key={s.runSessionId} value={s.runSessionId}>
                          {s.runSessionId} ({s.eventsCount} events)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 6 }}>
                    {runEvents.filter(evt => !selectedRunSession || evt.runSessionId === selectedRunSession).slice(-50).reverse().map((evt, idx) => (
                      <div key={idx} style={{ fontSize: 11, padding: 4, borderBottom: '1px solid #1f2a37', fontFamily: 'monospace' }}>
                        <span style={{ opacity: 0.6 }}>{evt.ts?.slice(11, 19) || 'no-ts'}</span>
                        {' '}
                        <span style={{ color: '#58a6ff' }}>{evt.type}</span>
                        {evt.taskTitle ? ` → ${evt.taskTitle}` : ''}
                        {evt.status ? ` [${evt.status}]` : ''}
                      </div>
                    ))}
                    {runEvents.length === 0 && <div style={{ opacity: 0.5, fontSize: 11 }}>No events yet</div>}
                  </div>
                </>
              )}
            </details>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
