/**
 * Report Generation Engine
 * 
 * Generates comprehensive reports in multiple formats:
 * - JSON: Raw data structure for programmatic processing
 * - CSV: Spreadsheet-compatible format
 * - HTML: Formatted for web viewing and email
 * - PDF: Professional document with styling (via server-side rendering)
 */

import { getStorageClient } from './storage.mjs';

/**
 * ReportBuilder class
 * Constructs comprehensive reports from project, session, and event data
 */
export class ReportBuilder {
  constructor(projectId, sessionId, plan, cost, events, summary) {
    this.projectId = projectId;
    this.sessionId = sessionId;
    this.plan = plan;
    this.cost = cost;
    this.events = events || [];
    this.summary = summary || {};
    this.generatedAt = new Date().toISOString();
  }

  /**
   * Generate JSON report
   * @returns {string} JSON-formatted report
   */
  generateJSON() {
    const report = {
      metadata: {
        projectId: this.projectId,
        sessionId: this.sessionId,
        generatedAt: this.generatedAt,
        format: 'application/json'
      },
      summary: {
        ...this.summary,
        duration: this.calculateDuration()
      },
      plan: {
        projectId: this.plan?.projectId,
        taskCount: this.plan?.tasks?.length || 0,
        tasks: this.plan?.tasks || []
      },
      cost: {
        totalCost: this.cost?.total || 0,
        costTwd: this.cost?.cost_twd || 0,
        costUsd: this.cost?.cost_usd || 0,
        calls: this.cost?.total?.calls || 0,
        tokens: this.cost?.total?.total_tokens || 0
      },
      events: {
        total: this.events.length,
        byType: this.groupEventsByType(),
        items: this.events
      },
      statistics: {
        commandCount: this.events.filter(e => e.type === 'cmd:exec').length,
        taskCount: this.events.filter(e => e.type === 'task:done').length,
        approvalCount: this.events.filter(e => e.type === 'DANGER_APPROVED' || e.type === 'DANGER_REJECTED').length,
        errorCount: this.events.filter(e => e.type === 'cmd:error' || e.error).length,
        successRate: this.calculateSuccessRate()
      }
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate CSV report
   * @returns {string} CSV-formatted report
   */
  generateCSV() {
    const rows = [];

    // Header row
    rows.push([
      'Timestamp',
      'Type',
      'Task Title',
      'Command',
      'Status',
      'Result',
      'Error',
      'Notes'
    ].map(h => `"${h}"`).join(','));

    // Event rows
    this.events.forEach(event => {
      const resultStr = event.result ? (typeof event.result === 'object' ? JSON.stringify(event.result) : String(event.result)) : '';
      rows.push([
        event.timestamp ? new Date(event.timestamp).toISOString() : (event.ts ? new Date(event.ts).toISOString() : ''),
        event.type || '',
        event.taskTitle ? event.taskTitle.replace(/"/g, '""') : (event.taskName ? event.taskName.replace(/"/g, '""') : ''),
        event.command ? event.command.replace(/"/g, '""').substring(0, 100) : '',
        event.status || '',
        resultStr.replace(/"/g, '""').substring(0, 200),
        event.error ? event.error.replace(/"/g, '""').substring(0, 200) : '',
        event.reason ? event.reason.replace(/"/g, '""') : ''
      ].map(v => `"${v}"`).join(','));
    });

    // Summary section
    rows.push('');
    rows.push('Summary Statistics');
    rows.push(['Metric', 'Value'].map(h => `"${h}"`).join(','));
    rows.push(['Project ID', `"${this.projectId}"`].join(','));
    rows.push(['Session ID', `"${this.sessionId}"`].join(','));
    rows.push(['Generated At', `"${this.generatedAt}"`].join(','));
    rows.push(['Total Events', this.events.length].join(','));
    rows.push(['Commands Executed', this.events.filter(e => e.type === 'cmd:exec').length].join(','));
    rows.push(['Tasks Completed', this.events.filter(e => e.type === 'task:done').length].join(','));
    rows.push(['Approvals', this.events.filter(e => e.type === 'DANGER_APPROVED' || e.type === 'DANGER_REJECTED').length].join(','));
    rows.push(['Errors', this.events.filter(e => e.type === 'cmd:error' || e.error).length].join(','));
    rows.push(['Success Rate', `"${(this.calculateSuccessRate() * 100).toFixed(1)}%"`].join(','));

    return rows.join('\n');
  }

  /**
   * Generate HTML report
   * @returns {string} HTML-formatted report
   */
  generateHTML() {
    const eventsByType = this.groupEventsByType();
    const successRate = this.calculateSuccessRate();

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report - ${this.projectId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
      color: #333;
      background: #f5f5f5;
      line-height: 1.6;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    header {
      border-bottom: 3px solid #1976d2;
      margin-bottom: 30px;
      padding-bottom: 20px;
    }
    
    h1 {
      color: #1976d2;
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    .meta {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 30px;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 6px;
    }
    
    .meta-item {
      text-align: center;
    }
    
    .meta-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .meta-value {
      font-size: 24px;
      font-weight: bold;
      color: #1976d2;
    }
    
    section {
      margin-bottom: 40px;
    }
    
    h2 {
      color: #333;
      font-size: 20px;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .stat-card {
      padding: 15px;
      background: #f9f9f9;
      border-radius: 6px;
      border-left: 4px solid #1976d2;
    }
    
    .stat-card.success {
      border-left-color: #2e7d32;
    }
    
    .stat-card.warning {
      border-left-color: #f57c00;
    }
    
    .stat-card.error {
      border-left-color: #d32f2f;
    }
    
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }
    
    .stat-value {
      font-size: 20px;
      font-weight: bold;
      color: #333;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    th {
      background: #f0f0f0;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #ddd;
      font-size: 13px;
    }
    
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    
    tr:hover {
      background: #f9f9f9;
    }
    
    .event-type {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .event-type.task {
      background: #e3f2fd;
      color: #0277bd;
    }
    
    .event-type.command {
      background: #fff3e0;
      color: #e65100;
    }
    
    .event-type.approval {
      background: #f3e5f5;
      color: #6a1b9a;
    }
    
    .event-type.error {
      background: #ffebee;
      color: #c62828;
    }
    
    .success-rate {
      font-size: 36px;
      font-weight: bold;
      color: #2e7d32;
      text-align: center;
      padding: 20px;
      background: #e8f5e9;
      border-radius: 6px;
    }
    
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }
    
    .command-block {
      background: #1c2128;
      color: #adbac7;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      margin: 10px 0;
    }
    
    footer {
      border-top: 2px solid #eee;
      padding-top: 20px;
      margin-top: 40px;
      color: #999;
      font-size: 12px;
      text-align: center;
    }
    
    @media print {
      body {
        background: white;
      }
      .container {
        box-shadow: none;
        padding: 20px;
      }
      section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Project Execution Report</h1>
      <p><strong>Project:</strong> ${this.projectId}</p>
      <p><strong>Session:</strong> ${this.sessionId}</p>
      <p><strong>Generated:</strong> ${new Date(this.generatedAt).toLocaleString()}</p>
    </header>

    <section>
      <div class="meta">
        <div class="meta-item">
          <div class="meta-label">Total Events</div>
          <div class="meta-value">${this.events.length}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Duration</div>
          <div class="meta-value">${this.formatDuration(this.calculateDuration())}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Tasks</div>
          <div class="meta-value">${this.events.filter(e => e.type === 'task:done').length}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Errors</div>
          <div class="meta-value" style="color: ${this.events.filter(e => e.error).length > 0 ? '#d32f2f' : '#2e7d32'}">${this.events.filter(e => e.error).length}</div>
        </div>
      </div>
    </section>

    <section>
      <h2>Success Rate</h2>
      <div class="success-rate">${(successRate * 100).toFixed(1)}%</div>
    </section>

    <section>
      <h2>Statistics</h2>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Commands Executed</div>
          <div class="stat-value">${this.events.filter(e => e.type === 'cmd:exec').length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Approvals</div>
          <div class="stat-value">${this.events.filter(e => e.type === 'DANGER_APPROVED' || e.type === 'DANGER_REJECTED').length}</div>
        </div>
        <div class="stat-card error">
          <div class="stat-label">Errors</div>
          <div class="stat-value">${this.events.filter(e => e.error).length}</div>
        </div>
      </div>
    </section>

    <section>
      <h2>Events by Type</h2>
      <table>
        <tr>
          <th>Event Type</th>
          <th>Count</th>
          <th>Percentage</th>
        </tr>
        ${Object.entries(eventsByType)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => `
            <tr>
              <td><span class="event-type ${type.includes('task') ? 'task' : type.includes('cmd') ? 'command' : 'approval'}">${type}</span></td>
              <td>${count}</td>
              <td>${((count / this.events.length) * 100).toFixed(1)}%</td>
            </tr>
          `).join('')}
      </table>
    </section>

    <section>
      <h2>Task Plan</h2>
      ${this.plan?.tasks && this.plan.tasks.length > 0 ? `
        <table>
          <tr>
            <th>Task</th>
            <th>Status</th>
            <th>Points</th>
            <th>Notes</th>
          </tr>
          ${this.plan.tasks.map(task => `
            <tr>
              <td><strong>${task.title || task.id}</strong></td>
              <td><span class="event-type ${task.status === 'done' ? 'success' : task.status === 'doing' ? 'command' : ''}">${task.status}</span></td>
              <td>${task.points || 0}</td>
              <td>${task.notes ? task.notes.substring(0, 100) : '-'}</td>
            </tr>
          `).join('')}
        </table>
      ` : `<p>No tasks defined</p>`}
    </section>

    <section>
      <h2>Cost Analysis</h2>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Total Cost (USD)</div>
          <div class="stat-value">$${(this.cost?.cost_usd || 0).toFixed(4)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Cost (TWD)</div>
          <div class="stat-value">TWD ${(this.cost?.cost_twd || 0).toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">API Calls</div>
          <div class="stat-value">${this.cost?.total?.calls || 0}</div>
        </div>
      </div>
    </section>

    <section>
      <h2>Recent Events</h2>
      <table>
        <tr>
          <th>Time</th>
          <th>Type</th>
          <th>Task</th>
          <th>Details</th>
        </tr>
        ${this.events.slice(-20).reverse().map(event => `
          <tr>
            <td>${new Date(event.ts).toLocaleTimeString()}</td>
            <td><span class="event-type ${event.type.includes('task') ? 'task' : event.type.includes('cmd') ? 'command' : 'approval'}">${event.type}</span></td>
            <td>${event.taskTitle || '-'}</td>
            <td>${event.command ? '<code>' + event.command.substring(0, 50) + '...</code>' : event.error ? '<strong style="color: #d32f2f;">Error: ' + event.error.substring(0, 50) + '</strong>' : event.status || '-'}</td>
          </tr>
        `).join('')}
      </table>
    </section>

    <footer>
      <p>This report was automatically generated by Shipyard Community v4.5</p>
      <p>Document: ${this.sessionId}_report | Generated: ${new Date(this.generatedAt).toISOString()}</p>
    </footer>
  </div>
</body>
</html>`;
  }

  /**
   * Generate PDF report (returns HTML for server-side PDF generation)
   * @returns {string} HTML suitable for PDF conversion
   */
  generatePDF() {
    // Returns HTML content (actual PDF generation handled by server via puppeteer/wkhtmltopdf)
    return this.generateHTML();
  }

  // ---- Helper Methods ----

  groupEventsByType() {
    const grouped = {};
    this.events.forEach(event => {
      grouped[event.type] = (grouped[event.type] || 0) + 1;
    });
    return grouped;
  }

  calculateSuccessRate() {
    if (this.events.length === 0) return 0;
    const successful = this.events.filter(e => !e.error && e.type !== 'cmd:error').length;
    return successful / this.events.length;
  }

  calculateDuration() {
    if (this.events.length < 2) return 0;
    const firstTs = new Date(this.events[0].ts).getTime();
    const lastTs = new Date(this.events[this.events.length - 1].ts).getTime();
    return Math.round((lastTs - firstTs) / 1000); // in seconds
  }

  formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }
}

/**
 * Generate and store a report in multiple formats
 * @param {string} projectId - Project identifier
 * @param {string} sessionId - Session identifier
 * @param {object} plan - Project plan
 * @param {object} cost - Cost data
 * @param {array} events - Event array
 * @param {object} summary - Session summary
 * @returns {Promise<object>} Report paths/URLs
 */
export async function generateAndStoreReport(projectId, sessionId, plan, cost, events, summary) {
  const builder = new ReportBuilder(projectId, sessionId, plan, cost, events, summary);
  const storage = getStorageClient();

  const reports = {};

  try {
    // JSON
    const jsonContent = builder.generateJSON();
    const jsonPath = await storage.storeReport(projectId, sessionId, 'json', jsonContent);
    reports.json = jsonPath;
  } catch (e) {
    console.error('[report] JSON generation failed:', e.message);
  }

  try {
    // CSV
    const csvContent = builder.generateCSV();
    const csvPath = await storage.storeReport(projectId, sessionId, 'csv', csvContent);
    reports.csv = csvPath;
  } catch (e) {
    console.error('[report] CSV generation failed:', e.message);
  }

  try {
    // HTML
    const htmlContent = builder.generateHTML();
    const htmlPath = await storage.storeReport(projectId, sessionId, 'html', htmlContent);
    reports.html = htmlPath;
  } catch (e) {
    console.error('[report] HTML generation failed:', e.message);
  }

  // PDF would require additional dependencies (puppeteer, wkhtmltopdf, etc.)
  // For now, we provide the HTML and let it be converted client-side or via server extension
  reports.pdf = null; // TODO: Implement PDF generation

  return {
    projectId,
    sessionId,
    generatedAt: new Date().toISOString(),
    reports
  };
}

export default {
  ReportBuilder,
  generateAndStoreReport
};
