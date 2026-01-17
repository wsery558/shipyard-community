import React, { useState, useEffect } from 'react';

/**
 * ProjectList - Displays all projects with status and allows switching
 */
export function ProjectList({ projects, activeProjectId, onSelectProject, onRefresh }) {
  const [expanded, setExpanded] = useState(false);

  if (!projects || projects.length === 0) {
    return <div className="project-list empty">No projects available</div>;
  }

  return (
    <div className="project-list">
      <div className="project-list-header">
        <button onClick={() => setExpanded(!expanded)} className="toggle-btn">
          {expanded ? '▼' : '▶'} Projects ({projects.length})
        </button>
        <button onClick={onRefresh} className="refresh-btn" title="Refresh projects">
          🔄
        </button>
      </div>

      {expanded && (
        <div className="project-list-items">
          {projects.map((proj) => (
            <ProjectListItem
              key={proj.id}
              project={proj}
              isActive={proj.id === activeProjectId}
              onSelect={() => onSelectProject(proj.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ProjectListItem - Single project row
 */
function ProjectListItem({ project, isActive, onSelect }) {
  const status = project.status || 'idle';
  const taskCount = project.taskCount || 0;
  const healthStatus = project.health || 'unknown';

  return (
    <div
      className={`project-item ${isActive ? 'active' : ''} status-${status} health-${healthStatus}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <div className="project-item-main">
        <div className="project-name">{project.name || project.id}</div>
        <div className="project-meta">
          {taskCount > 0 && <span className="badge tasks">{taskCount} tasks</span>}
          <span className={`badge health health-${healthStatus}`}>{healthStatus}</span>
          <span className={`badge status status-${status}`}>{status}</span>
        </div>
      </div>
      {isActive && <div className="active-indicator">●</div>}
    </div>
  );
}

/**
 * ProjectDetail - Shows detailed info, tasks, health, reports for selected project
 */
export function ProjectDetail({ project, plan, cost, health, runState, onAction }) {
  const [view, setView] = useState('tasks'); // 'tasks', 'health', 'replay', 'reports', 'queue', 'policy', 'compliance'
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  if (!project) {
    return <div className="project-detail empty">Select a project to view details</div>;
  }

  return (
    <div className="project-detail">
      <div className="project-detail-header">
        <h2>{project.name || project.id}</h2>
        <div className="project-detail-tabs">
          <button
            className={`tab ${view === 'tasks' ? 'active' : ''}`}
            onClick={() => setView('tasks')}
          >
            Tasks
          </button>
          <button
            className={`tab ${view === 'health' ? 'active' : ''}`}
            onClick={() => setView('health')}
          >
            Health
          </button>
          <button
            className={`tab ${view === 'replay' ? 'active' : ''}`}
            onClick={() => setView('replay')}
          >
            🎬 Replay
          </button>
          <button
            className={`tab ${view === 'reports' ? 'active' : ''}`}
            onClick={() => setView('reports')}
          >
            📊 Reports
          </button>
          <button
            className={`tab ${view === 'queue' ? 'active' : ''}`}
            onClick={() => setView('queue')}
          >
            ⏱ Queue
          </button>
          <button
            className={`tab ${view === 'policy' ? 'active' : ''}`}
            onClick={() => setView('policy')}
          >
            🔒 Policy
          </button>
          <button
            className={`tab ${view === 'compliance' ? 'active' : ''}`}
            onClick={() => setView('compliance')}
          >
            ✅ Compliance
          </button>
          <button
            className={`tab ${view === 'platform' ? 'active' : ''}`}
            onClick={() => setView('platform')}
          >
            🏛️ Platform
          </button>
        </div>
      </div>

      {view === 'tasks' && (
        <ProjectTaskList
          plan={plan}
          runState={runState}
          onGenerateReport={() => onAction('generateReport')}
        />
      )}

      {view === 'health' && (
        <ProjectHealth
          health={health}
          cost={cost}
          onRefresh={() => onAction('refreshHealth')}
        />
      )}

      {view === 'replay' && (
        <ProjectReplayTab
          projectId={project.id}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
        />
      )}

      {view === 'reports' && (
        <ProjectReports
          projectId={project.id}
          selectedSessionId={selectedSessionId}
          onExport={(format) => onAction('exportReport', format)}
        />
      )}

      {view === 'queue' && (
        <QueueStatusPanel projectId={project.id} />
      )}

      {view === 'policy' && (
        <PolicyApprovalsPanel projectId={project.id} />
      )}

      {view === 'compliance' && (
        <CompliancePanel projectId={project.id} />
      )}

      {view === 'platform' && (
        <PlatformPortfolioPanel />
      )}
    </div>
  );
}

/**
 * ProjectTaskList - Display tasks with status
 */
function ProjectTaskList({ plan, runState, onGenerateReport }) {
  const tasks = plan?.tasks || [];
  const todoCount = tasks.filter((t) => !t.status || t.status === 'todo').length;
  const doingCount = tasks.filter((t) => t.status === 'doing').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="task-list">
      <div className="task-summary">
        <span className="stat todo">{todoCount} Todo</span>
        <span className="stat doing">{doingCount} In Progress</span>
        <span className="stat done">{doneCount} Done</span>
        <span className={`run-state state-${runState}`}>{runState}</span>
      </div>

      <div className="task-items">
        {tasks.length === 0 ? (
          <div className="empty-message">No tasks created yet</div>
        ) : (
          tasks.map((task) => (
            <TaskItemDetail key={task.id} task={task} />
          ))
        )}
      </div>

      <div className="task-actions">
        <button onClick={onGenerateReport} className="btn-primary">
          📄 Generate Report
        </button>
      </div>
    </div>
  );
}

/**
 * QueueStatusPanel - Minimal queue status view
 */
function QueueStatusPanel({ projectId }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/queue/status?project=${encodeURIComponent(projectId)}`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  return (
    <div className="queue-panel">
      <div className="panel-header">
        <h3>Queue Status</h3>
        <button className="btn-secondary" onClick={load}>Refresh</button>
      </div>
      {loading && <div className="loading-spinner">Loading…</div>}
      {error && <div className="error-message">Error: {error}</div>}
      {status && (
        <div className="queue-content">
          <div className="metric"><label>Executing</label><div>{status.executing ? 'yes' : 'no'}</div></div>
          <div className="metric"><label>Queue Size</label><div>{status.queueSize ?? 0}</div></div>
          <div className="metric"><label>Current Task</label><div>{status.currentTask?.label || '-'}</div></div>
          <div className="metric"><label>Next Task</label><div>{status.nextTask?.label || '-'}</div></div>
          <div className="metric"><label>Stats</label><div>
            queued: {status.stats?.queued ?? 0}, running: {status.stats?.running ?? 0}, completed: {status.stats?.completed ?? 0}, failed: {status.stats?.failed ?? 0}
          </div></div>
        </div>
      )}
    </div>
  );
}

/**
 * PolicyApprovalsPanel - List and actions for pending approvals
 */
function PolicyApprovalsPanel({ projectId }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/policy/pending');
      const data = await res.json();
      const list = Array.isArray(data.pending) ? data.pending : [];
      setPending(list.filter(p => !projectId || p.projectId === projectId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const approve = async (item) => {
    try {
      const res = await fetch('/api/policy/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: item.projectId, taskId: item.taskId, approverName: 'PM' })
      });
      if (!res.ok) throw new Error('approve failed');
      await load();
      alert('Approved and resumed');
    } catch (e) {
      alert(`Approve error: ${e.message}`);
    }
  };

  const reject = async (item) => {
    try {
      const res = await fetch('/api/policy/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: item.projectId, taskId: item.taskId, rejectionReason: 'PM rejected' })
      });
      if (!res.ok) throw new Error('reject failed');
      await load();
      alert('Rejected and paused');
    } catch (e) {
      alert(`Reject error: ${e.message}`);
    }
  };

  return (
    <div className="policy-panel">
      <div className="panel-header">
        <h3>Pending Approvals</h3>
        <button className="btn-secondary" onClick={load}>Refresh</button>
      </div>
      {loading && <div className="loading-spinner">Loading…</div>}
      {error && <div className="error-message">Error: {error}</div>}
      <div className="approvals-list">
        {pending.length === 0 ? (
          <div className="empty-message">No pending approvals</div>
        ) : (
          pending.map((p) => (
            <div key={`${p.projectId}:${p.taskId}`} className="approval-item">
              <div className="approval-main">
                <div className="approval-title">{p.projectId} — {p.taskId}</div>
                <div className="approval-meta">severity: {p.severity || '-'} | {new Date(p.timestamp).toLocaleString()}</div>
                <div className="approval-command"><code>{String(p.command || '').slice(0, 120)}</code></div>
              </div>
              <div className="approval-actions">
                <button className="btn-primary" onClick={() => approve(p)}>Approve</button>
                <button className="btn-secondary" onClick={() => reject(p)}>Reject</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * TaskItemDetail - Single task display
 */
function TaskItemDetail({ task }) {
  const statusClass = task.status || 'todo';

  return (
    <div className={`task-item status-${statusClass}`}>
      <div className="task-header">
        <span className={`status-badge status-${statusClass}`}>{statusClass}</span>
        <span className="task-title">{task.title}</span>
        {task.points && <span className="points">{task.points}pt</span>}
      </div>
      {task.notes && <div className="task-notes">{task.notes}</div>}
    </div>
  );
}

/**
 * ProjectHealth - Health metrics and alerts
 */
function ProjectHealth({ health, cost, onRefresh }) {
  const costData = cost || {};
  const totalCost = costData.total || 0;
  const budget = costData.budget || 0;

  return (
    <div className="health-panel">
      <div className="health-refresh">
        <button onClick={onRefresh} className="btn-secondary">
          🔄 Refresh Health
        </button>
      </div>

      <div className="health-metrics">
        <div className="metric">
          <label>Health Status</label>
          <div className={`value health-${health?.status || 'unknown'}`}>
            {health?.status || 'Unknown'}
          </div>
        </div>

        {health?.warnings && health.warnings.length > 0 && (
          <div className="metric warnings">
            <label>⚠️ Warnings ({health.warnings.length})</label>
            <ul>
              {health.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="metric">
          <label>Cost Tracking</label>
          <div className="cost-info">
            <div>Total Cost: ${totalCost.toFixed(2)}</div>
            {budget > 0 && (
              <div className={`budget-bar ${totalCost >= budget ? 'exceeded' : ''}`}>
                <div
                  className="budget-used"
                  style={{ width: `${Math.min(100, (totalCost / budget) * 100)}%` }}
                ></div>
                <span className="budget-text">
                  {totalCost.toFixed(2)} / ${budget.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ProjectReplayTab - Cloud replay interface with session selection
 */
function ProjectReplayTab({ projectId, selectedSessionId, onSelectSession }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Import components dynamically
  const [ReplayView, setReplayView] = useState(null);
  
  useEffect(() => {
    // Load ReplayView component
    import('./ReplayView.jsx')
      .then(module => setReplayView(() => module.ReplayView))
      .catch(err => console.error('Failed to load ReplayView:', err));
    
    // Load sessions
    const loadSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/replay-sessions?project=${encodeURIComponent(projectId)}&limit=50`);
        if (!res.ok) {
          throw new Error('Failed to load sessions');
        }
        const data = await res.json();
        setSessions(data.sessions || []);
        
        // Auto-select first session if none selected
        if (!selectedSessionId && data.sessions && data.sessions.length > 0) {
          onSelectSession(data.sessions[0].sessionId);
        }
      } catch (err) {
        console.error('[ProjectReplayTab] error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadSessions();
  }, [projectId]);
  
  if (loading) {
    return (
      <div className="replay-panel loading">
        <div className="loading-spinner">Loading sessions...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="replay-panel error">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }
  
  if (sessions.length === 0) {
    return (
      <div className="replay-panel empty">
        <div className="empty-message">
          <h3>No Sessions Available</h3>
          <p>Start working on this project to create replay sessions.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="replay-panel">
      <div className="replay-sidebar">
        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>
          Session History ({sessions.length})
        </h4>
        <div className="session-list">
          {sessions.map(session => (
            <div
              key={session.sessionId}
              className={`session-item ${selectedSessionId === session.sessionId ? 'active' : ''}`}
              onClick={() => onSelectSession(session.sessionId)}
              style={{
                padding: '12px',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                marginBottom: '8px',
                cursor: 'pointer',
                background: selectedSessionId === session.sessionId ? '#e3f2fd' : '#ffffff',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                {session.sessionId.substring(0, 12)}...
              </div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                {session.eventCount || 0} events
              </div>
              {session.startTime && (
                <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                  {new Date(session.startTime).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="replay-content">
        {selectedSessionId && ReplayView ? (
          <ReplayView
            projectId={projectId}
            sessionId={selectedSessionId}
            onClose={() => onSelectSession(null)}
          />
        ) : (
          <div className="replay-placeholder">
            <p>Select a session from the list to view replay</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ProjectReports - Report generation and export
 */
function ProjectReports({ projectId, selectedSessionId, onExport }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(selectedSessionId);
  const [ReportGenerator, setReportGenerator] = useState(null);
  
  useEffect(() => {
    // Load ReportGenerator component
    import('./ReportGenerator.jsx')
      .then(module => setReportGenerator(() => module.ReportGenerator))
      .catch(err => console.error('Failed to load ReportGenerator:', err));
    
    // Load sessions
    const loadSessions = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/replay-sessions?project=${encodeURIComponent(projectId)}&limit=50`);
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions || []);
          
          // Auto-select first session if none selected
          if (!currentSessionId && data.sessions && data.sessions.length > 0) {
            setCurrentSessionId(data.sessions[0].sessionId);
          }
        }
      } catch (err) {
        console.error('[ProjectReports] error loading sessions:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadSessions();
  }, [projectId]);
  
  return (
    <div className="reports-panel">
      <div className="reports-header">
        <h3>Generate & Export Reports</h3>
        <p style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
          Generate comprehensive reports for your project sessions
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          Loading sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ 
          padding: '40px 20px', 
          textAlign: 'center', 
          color: '#999',
          background: '#f9f9f9',
          borderRadius: '8px'
        }}>
          <h4 style={{ marginBottom: '8px', color: '#666' }}>No Sessions Available</h4>
          <p>Start working on this project to create sessions and generate reports.</p>
        </div>
      ) : (
        <>
          {/* Session Selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#333'
            }}>
              Select Session
            </label>
            <select
              value={currentSessionId || ''}
              onChange={(e) => setCurrentSessionId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                background: '#ffffff',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="">-- Select a session --</option>
              {sessions.map(session => (
                <option key={session.sessionId} value={session.sessionId}>
                  {session.sessionId.substring(0, 16)}... 
                  ({session.eventCount || 0} events) 
                  {session.startTime ? ' - ' + new Date(session.startTime).toLocaleString() : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Report Generator */}
          {currentSessionId && ReportGenerator ? (
            <ReportGenerator projectId={projectId} sessionId={currentSessionId} />
          ) : (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#999',
              border: '1px dashed #e0e0e0',
              borderRadius: '8px'
            }}>
              Select a session to generate reports
            </div>
          )}

          {/* Legacy Export Options */}
          <div style={{ 
            marginTop: '40px',
            paddingTop: '40px',
            borderTop: '1px solid #e0e0e0'
          }}>
            <h4 style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
              Legacy Export Options
            </h4>
            <div className="reports-actions">
              <div className="export-group">
                <label>Audit & Approval History</label>
                <div className="export-buttons">
                  <button onClick={() => onExport('json')} className="btn-export">
                    📋 JSON
                  </button>
                  <button onClick={() => onExport('csv')} className="btn-export">
                    📊 CSV
                  </button>
                  <button onClick={() => onExport('html')} className="btn-export">
                    📄 HTML
                  </button>
                </div>
              </div>

              <div className="export-group">
                <label>Execution Report</label>
                <div className="export-buttons">
                  <button onClick={() => onExport('execution-md')} className="btn-export">
                    📝 Markdown
                  </button>
                  <button onClick={() => onExport('execution-pdf')} className="btn-export">
                    📑 PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * DangerCommandApprovalPrompt - Shows when dangerous command detected
 */
export function DangerCommandApprovalPrompt({
  taskId,
  command,
  reason,
  severity,
  onApprove,
  onReject,
  isProcessing = false,
}) {
  const severityColor = {
    critical: '#d32f2f',
    high: '#f57c00',
    medium: '#fbc02d',
    low: '#2196f3',
  }[severity] || '#757575';

  return (
    <div className="approval-prompt">
      <div className="approval-header">
        <span className="approval-title">⚠️ Dangerous Command Requires Approval</span>
      </div>

      <div className="approval-content">
        <div className="approval-details">
          <div className="detail-row">
            <label>Task ID:</label>
            <span>{taskId}</span>
          </div>

          <div className="detail-row">
            <label>Severity:</label>
            <span className="severity-badge" style={{ backgroundColor: severityColor }}>
              {severity}
            </span>
          </div>

          <div className="detail-row">
            <label>Reason:</label>
            <span className="reason">{reason}</span>
          </div>

          <div className="command-block">
            <label>Command:</label>
            <pre className="command-code">{command}</pre>
          </div>
        </div>

        <div className="approval-actions">
          <button
            onClick={onReject}
            disabled={isProcessing}
            className="btn-reject"
          >
            ❌ Reject
          </button>
          <button
            onClick={onApprove}
            disabled={isProcessing}
            className="btn-approve"
          >
            ✅ Approve
          </button>
          {isProcessing && <span className="processing">Processing...</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * AuditLog - Display approval history
 */
export function AuditLog({ events = [], onExport }) {
  const approvalEvents = events.filter(
    (e) => e.type === 'POLICY_EVALUATED' || e.type === 'POLICY_REQUIRES_APPROVAL' || e.type === 'DANGER_APPROVED' || e.type === 'DANGER_REJECTED'
  );

  return (
    <div className="audit-log">
      <div className="audit-header">
        <h3>Audit & Approval History</h3>
        <button onClick={() => onExport('csv')} className="btn-export-small">
          📥 Export CSV
        </button>
      </div>

      <div className="audit-items">
        {approvalEvents.length === 0 ? (
          <div className="empty-message">No approval events recorded</div>
        ) : (
          approvalEvents.map((event, idx) => (
            <AuditEventItem key={idx} event={event} />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * AuditEventItem - Single audit event
 */
function AuditEventItem({ event }) {
  const typeIcon = {
    POLICY_EVALUATED: '📋',
    POLICY_REQUIRES_APPROVAL: '⚠️',
    DANGER_APPROVED: '✅',
    DANGER_REJECTED: '❌',
  }[event.type] || '📌';

  return (
    <div className={`audit-item type-${event.type}`}>
      <div className="audit-icon">{typeIcon}</div>
      <div className="audit-details">
        <div className="audit-type">{event.type}</div>
        <div className="audit-command">{event.command || event.bash}</div>
        <div className="audit-meta">
          <span className="timestamp">{new Date(event.ts).toLocaleString()}</span>
          {event.reason && <span className="reason">{event.reason}</span>}
          {event.severity && (
            <span className={`severity-badge severity-${event.severity}`}>
              {event.severity}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CompliancePanel - Display and manage compliance checks
 */
function CompliancePanel({ projectId }) {
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState('');

  // Load compliance status on mount
  React.useEffect(() => {
    loadComplianceStatus();
  }, [projectId]);

  async function loadComplianceStatus() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/compliance/status?projectId=${projectId}`);
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
      } else {
        setError(data.error || 'Failed to load status');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runCompliance() {
    try {
      setRunning(true);
      setError('');
      const res = await fetch('/api/compliance/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      const data = await res.json();
      if (res.ok) {
        // Reload status
        setTimeout(loadComplianceStatus, 500);
      } else {
        setError(data.error || 'Failed to run compliance');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  const active = status?.active;
  const passive = status?.passive;
  const statusColor = (state) => {
    if (state === 'pass' || state === 'compliant' || state === 'ok') return 'green';
    if (state === 'warn' || state === 'partial') return 'orange';
    return 'red';
  };
  const contractCheck = active?.checks?.find(c => c.name === 'contract-enforcer');

  return (
    <div className="compliance-panel">
      <div className="compliance-header">
        <h3>Compliance Status</h3>
        <button
          className="btn-primary"
          onClick={runCompliance}
          disabled={running || loading}
        >
          {running ? '🔄 Running...' : '▶ Run Compliance'}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="loading">Loading compliance status...</div>
      ) : !active ? (
        <div className="empty-state">
          <p>No compliance checks have been run yet.</p>
          <p>Click "Run Compliance" to start.</p>
        </div>
      ) : (
        <div className="compliance-details">
          <div className="status-header">
            <div className={`status-badge status-${statusColor(active.status)}`}>{String(active.status || '').toUpperCase()}</div>
            <div className="status-info">
              <div className="last-run">
                {active.lastRunAt
                  ? `Last run: ${new Date(active.lastRunAt).toLocaleString()}`
                  : 'Never run'}
              </div>
              {active.durationMs && <div className="duration">{active.durationMs}ms</div>}
            </div>
          </div>

          {active.checks && active.checks.length > 0 ? (
            <div className="checks-list">
              <h4>Checks ({active.checksCount || 0})</h4>
              {active.checks.map((check, idx) => (
                <div key={idx} className={`check-item check-${check.status}`}>
                  <div className="check-icon">
                    {check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌'}
                  </div>
                  <div className="check-details">
                    <div className="check-name">{check.name}</div>
                    <div className="check-reason">{check.reason}</div>
                    {check.evidencePath && (
                      <div className="check-evidence">
                        <code>{check.evidencePath}</code>
                        <button
                          className="btn-copy"
                          onClick={() => navigator.clipboard.writeText(check.evidencePath)}
                          title="Copy path"
                        >
                          📋
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-checks">No checks available</div>
          )}

          {active.evidencePath && (
            <div className="evidence-link">
              <p>Evidence path: <code>{active.evidencePath}</code></p>
            </div>
          )}

          {contractCheck && (
            <div className="contract-section">
              <h4>Contract Enforcer</h4>
              <div className={`contract-status status-${contractCheck.status}`}>
                {contractCheck.status === 'non_compliant' ? '❌' : '✅'} {contractCheck.reason}
              </div>
            </div>
          )}

          {passive && (
            <div className="passive-section">
              <h4>Passive Compliance</h4>
              <div className={`status-badge status-${statusColor(passive.status)}`}>{String(passive.status || '').toUpperCase()}</div>
              <div className="passive-checks">
                <div>Entitlements: {passive.checks?.entitlements ? '✅' : '❌'}</div>
                <div>Events: {passive.checks?.events ? '✅' : '❌'}</div>
                <div>Audit: {passive.checks?.audit ? '✅' : '❌'}</div>
                <div>Metrics: {passive.checks?.metrics ? '✅' : '❌'}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PlatformPortfolioPanel - Show platform SSOT overview (OPEN-ONLY: Disabled)
 */
function PlatformPortfolioPanel() {
  return (
    <div className="portfolio-panel disabled">
      <div className="portfolio-header">
        <h3>🏛️ Platform Portfolio</h3>
      </div>
      <div className="notice-box">
        <p><strong>Not available in Open Core</strong></p>
        <p style={{fontSize: '0.9em', color: '#666', marginTop: '0.5em'}}>
          Platform features (entitlements, metrics, compliance, events) require the paid-platform module.
        </p>
        <p style={{fontSize: '0.85em', color: '#999', marginTop: '0.5em'}}>
          For details, see <code>OPEN_DELIVERY.md</code> in the repository root.
        </p>
      </div>
    </div>
  );
}
