/**
 * Plan management utilities
 */

/**
 * Normalize task object with defaults
 * @param {Object} task - Task object
 * @param {number} idx - Index for ID generation
 * @returns {Object} Normalized task
 */
export function normalizeTask(task, idx = 0) {
  if (!task || typeof task !== 'object') {
    return {
      id: `task_${Date.now()}_${idx}`,
      title: 'Untitled',
      points: 1,
      status: 'todo',
      verify: [],
      notes: ''
    };
  }

  const id = task.id || (task.title 
    ? (task.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + idx)
    : `task_${Date.now()}_${idx}`);
  
  return {
    id,
    title: task.title || 'Untitled',
    points: Number(task.points) || 1,
    status: task.status || 'todo',
    verify: Array.isArray(task.verify) ? task.verify : [],
    notes: task.notes || ''
  };
}

/**
 * Merge incoming tasks with existing plan, preserving done/blocked status
 * @param {Object} existing - Existing plan { tasks: [] }
 * @param {Object} incoming - Incoming plan { tasks: [] }
 * @returns {Object} Merged plan { tasks: [] }
 */
export function mergePlans(existing, incoming) {
  const existingTasks = existing?.tasks || [];
  const incomingTasks = incoming?.tasks || [];
  
  // Build lookup maps
  const byId = new Map(existingTasks.map(t => [t.id, t]));
  const byTitle = new Map(existingTasks.map(t => [t.title, t]));
  
  // Process incoming tasks
  const mergedTasks = incomingTasks.map((inTask, idx) => {
    // Find existing task by id or title
    let existingTask = null;
    if (inTask.id && byId.has(inTask.id)) {
      existingTask = byId.get(inTask.id);
    } else if (inTask.title && byTitle.has(inTask.title)) {
      existingTask = byTitle.get(inTask.title);
    }
    
    // If existing task found, preserve critical fields
    if (existingTask) {
      return {
        ...inTask,
        id: existingTask.id || inTask.id,
        status: existingTask.status === 'done' || existingTask.status === 'blocked' 
          ? existingTask.status 
          : inTask.status || 'todo',
        points: existingTask.points || inTask.points || 1,
        notes: existingTask.notes || inTask.notes || ''
      };
    }
    
    // New task - normalize it
    return normalizeTask(inTask, idx);
  });
  
  return { tasks: mergedTasks };
}

/**
 * Compute plan progress metrics
 * @param {Object} plan - Plan object { tasks: [] }
 * @returns {Object} { donePoints, totalPoints, percent }
 */
export function computeProgress(plan) {
  const tasks = plan?.tasks || [];
  
  let totalPoints = 0;
  let donePoints = 0;
  
  for (const task of tasks) {
    const points = Number(task.points) || 0;
    totalPoints += points;
    if (task.status === 'done') {
      donePoints += points;
    }
  }
  
  const percent = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
  
  return { donePoints, totalPoints, percent };
}
