#!/usr/bin/env node
/**
 * Report Generator - builds Markdown reports from run events
 */

/**
 * Extract the latest plan snapshot from events
 * Returns the plan from the latest "plan:updated" event, or fallback to provided plan
 */
export function extractSessionPlanSnapshot(events, fallbackPlan) {
  const planEvents = events.filter(e => e.type === 'plan:updated' && e.plan);
  if (planEvents.length === 0) {
    return fallbackPlan;
  }
  // Get the last plan:updated event
  return planEvents[planEvents.length - 1].plan || fallbackPlan;
}

/**
 * Extract the latest cost snapshot from events
 * Returns the cost from the latest "cost:updated" or "COST_UPDATED" event
 */
export function extractSessionCostSnapshot(events, fallbackCost) {
  const costEvents = events.filter(e => 
    (e.type === 'cost:updated' || e.type === 'COST_UPDATED') && e.cost
  );
  if (costEvents.length === 0) {
    return fallbackCost;
  }
  return costEvents[costEvents.length - 1].cost || fallbackCost;
}

/**
 * Derive the final plan state by overlaying task completion statuses from events
 * This maps task titles to their final status based on TASK_FINISHED/completion events
 */
export function deriveSessionFinalPlan(events, basePlan) {
  if (!basePlan || !basePlan.tasks) {
    return basePlan;
  }

  // Build a status map from TASK_FINISHED and other completion events
  const taskStatusMap = {};
  
  events.forEach(evt => {
    if (evt.type === 'TASK_FINISHED' && evt.taskTitle) {
      // Map task title to final status from event
      // Prefer blocked over done (blocked is more serious)
      const newStatus = evt.status || 'todo';
      const currentStatus = taskStatusMap[evt.taskTitle];
      
      // Update status, preferring blocked over done
      if (!currentStatus || newStatus === 'blocked' || (currentStatus === 'todo' && newStatus === 'done')) {
        taskStatusMap[evt.taskTitle] = newStatus;
      }
    }
  });

  // If no status changes found, return base plan as-is
  if (Object.keys(taskStatusMap).length === 0) {
    return basePlan;
  }

  // Create a new plan with updated task statuses
  const derivedPlan = {
    ...basePlan,
    tasks: basePlan.tasks.map(task => {
      const finalStatus = taskStatusMap[task.title];
      if (finalStatus && task.status !== finalStatus) {
        return { ...task, status: finalStatus };
      }
      return task;
    })
  };

  return derivedPlan;
}

/**
 * Compute task status summary from a plan
 */
export function computeTaskStats(plan) {
  const tasks = plan?.tasks || [];
  const totalPoints = tasks.reduce((s, t) => s + (Number(t.points) || 0), 0) || 1;
  const donePoints = tasks.reduce((s, t) => s + ((t.status === 'done') ? (Number(t.points) || 0) : 0), 0);
  const progressPct = Math.round((donePoints / totalPoints) * 100);
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  
  return { progressPct, donePoints, totalPoints, doneTasks, totalTasks: tasks.length };
}

export function buildMarkdownReport({ project, plan, cost, events, runSessionId }) {
  const lines = [];
  
  // Extract session-final plan and cost from events
  let sessionPlan = extractSessionPlanSnapshot(events, plan);
  // Derive final plan by overlaying completion statuses from events
  sessionPlan = deriveSessionFinalPlan(events, sessionPlan);
  const sessionCost = extractSessionCostSnapshot(events, cost);
  
  // Header
  lines.push('# Agent Dashboard Run Report');
  lines.push('');
  lines.push(`**Project:** ${project || 'unknown'}`);
  lines.push(`**Run Session ID:** ${runSessionId || 'unknown'}`);
  
  // Time range
  const timestamps = events.filter(e => e.ts).map(e => new Date(e.ts));
  if (timestamps.length > 0) {
    const start = new Date(Math.min(...timestamps));
    const end = new Date(Math.max(...timestamps));
    lines.push(`**Time Range:** ${start.toISOString()} → ${end.toISOString()}`);
    const durationMs = end - start;
    const durationMin = Math.floor(durationMs / 60000);
    const durationSec = Math.floor((durationMs % 60000) / 1000);
    lines.push(`**Duration:** ${durationMin}m ${durationSec}s`);
  }
  
  // Progress & Cost
  const stats = computeTaskStats(sessionPlan);
  
  lines.push(`**Progress:** ${stats.progressPct}% (${stats.donePoints}/${stats.totalPoints} points)`);
  lines.push(`**Tasks Done:** ${stats.doneTasks}/${stats.totalTasks}`);
  
  if (sessionCost && sessionCost.total) {
    lines.push(`**Cost:** ${sessionCost.total.calls || 0} calls, ${sessionCost.total.total_tokens || 0} tokens, ~${(sessionCost.total.estimated_twd || 0).toFixed(2)} TWD`);
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Plan Snapshot
  lines.push('## Plan Snapshot');
  lines.push('');
  
  const tasks = sessionPlan?.tasks || [];
  if (tasks.length === 0) {
    lines.push('*No tasks*');
  } else {
    tasks.forEach((task, idx) => {
      const status = task.status || 'todo';
      const icon = status === 'done' ? '✅' : status === 'doing' ? '🔄' : status === 'blocked' ? '❌' : '⏳';
      lines.push(`${idx + 1}. ${icon} **${task.title}** (${status}, ${task.points || 0} points)`);
      if (task.notes) {
        lines.push(`   *Notes: ${task.notes}*`);
      }
    });
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Timeline
  lines.push('## Timeline');
  lines.push('');
  
  const taskEvents = events.filter(e => 
    ['TASK_STARTED', 'TASK_FINISHED', 'COMMAND_PROPOSED', 'COMMAND_EXECUTED', 
     'DANGER_REQUIRES_APPROVAL', 'DANGER_APPROVED', 'TEST_RUN', 'DEPLOY_RUN'].includes(e.type)
  );
  
  if (taskEvents.length === 0) {
    lines.push('*No task events*');
  } else {
    let currentTask = null;
    
    taskEvents.forEach(event => {
      const time = event.ts ? new Date(event.ts).toLocaleTimeString() : 'unknown';
      
      if (event.type === 'TASK_STARTED') {
        currentTask = event.taskTitle || event.taskId;
        lines.push(`### 🔄 ${currentTask}`);
        lines.push(`*Started at ${time}*`);
        lines.push('');
      } else if (event.type === 'TASK_FINISHED') {
        const status = event.status || 'unknown';
        const icon = status === 'done' ? '✅' : '❌';
        lines.push(`${icon} **Finished:** ${status} (${time})`);
        lines.push('');
      } else if (event.type === 'COMMAND_PROPOSED') {
        lines.push(`**Command Proposed:**`);
        lines.push('```bash');
        lines.push(event.bash || event.command || '(no command)');
        lines.push('```');
        lines.push('');
      } else if (event.type === 'COMMAND_EXECUTED') {
        lines.push(`**Executed:** exit code ${event.exitCode || 0}`);
        if (event.stdout) {
          lines.push('<details><summary>stdout</summary>');
          lines.push('');
          lines.push('```');
          lines.push(event.stdout);
          lines.push('```');
          lines.push('</details>');
          lines.push('');
        }
        if (event.stderr) {
          lines.push('<details><summary>stderr</summary>');
          lines.push('');
          lines.push('```');
          lines.push(event.stderr);
          lines.push('```');
          lines.push('</details>');
          lines.push('');
        }
      } else if (event.type === 'DANGER_REQUIRES_APPROVAL') {
        lines.push(`⚠️ **Danger Detected:** ${event.dangerReason || 'unknown'}`);
        if (event.dangerCode) {
          lines.push(`*Code: ${event.dangerCode}*`);
        }
        lines.push('');
      } else if (event.type === 'DANGER_APPROVED') {
        lines.push(`✓ **Danger Approved** (${time})`);
        lines.push('');
      } else if (event.type === 'TEST_RUN') {
        lines.push(`**Test Run:** ${event.command || 'unknown'}`);
        if (event.result) {
          lines.push(`*Result: ${event.result}*`);
        }
        lines.push('');
      } else if (event.type === 'DEPLOY_RUN') {
        lines.push(`**Deploy Run:** ${event.command || 'unknown'}`);
        if (event.result) {
          lines.push(`*Result: ${event.result}*`);
        }
        lines.push('');
      }
    });
  }
  
  // Failed/Blocked tasks
  const failedTasks = tasks.filter(t => t.status === 'blocked');
  if (failedTasks.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## ⚠️ Failed/Blocked Tasks');
    lines.push('');
    failedTasks.forEach(task => {
      lines.push(`- **${task.title}**`);
      if (task.notes) {
        lines.push(`  ${task.notes}`);
      }
    });
    lines.push('');
  }
  
  // Stall Signals
  const stallEvents = events.filter(e => e.type === 'COMMAND_STALL');
  if (stallEvents.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## ⚠️ Stall Signals');
    lines.push('');
    const first = stallEvents[0];
    lines.push(`- **First stall:** command ${first.commandId || '(unknown)'} at ${first.ts || ''}`);
    if (first.hint) lines.push(`  - Hint: ${first.hint}`);
    lines.push('');
  }

  // Verification Results
  const verifyEvents = events.filter(e => e.type === 'VERIFY_RESULT');
  if (verifyEvents.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## ✅ Verification Results');
    lines.push('');
    const latest = verifyEvents[verifyEvents.length - 1];
    const vr = latest.verifyResult || {};
    lines.push(`- **Project:** ${latest.project || project}`);
    lines.push(`- **Run Session:** ${latest.runSessionId || runSessionId}`);
    if (vr.summary) {
      lines.push(`- **Summary:** passed ${vr.summary.passed}/${vr.summary.total}, failed ${vr.summary.failed}`);
    } else if (vr.results && Array.isArray(vr.results)) {
      lines.push(`- **Commands run:** ${vr.results.length}`);
    }
    lines.push('');
  }
  // Footer
  lines.push('---');
  lines.push(`*Generated at ${new Date().toISOString()}*`);
  
  return lines.join('\n');
}
