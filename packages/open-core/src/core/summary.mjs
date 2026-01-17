/**
 * Minimal summary helpers for smoke and unit tests
 */
export async function buildSummary(contextSnapshot, recentEvents, plan) {
  // Simple deterministic summary for smoke mode or when LLM unavailable
  const project = (plan && plan.project) || 'project';
  const tasks = (plan && plan.tasks) ? plan.tasks.length : 0;
  return `Project ${project}: ${tasks} tasks (auto-summary)`;
}

export async function buildOfflineSummary(contextSnapshot, recentEvents, plan) {
  return buildSummary(contextSnapshot, recentEvents, plan);
}
