/**
 * Project Queue Manager
 * 
 * Implements per-project task queuing with global concurrency control:
 * - Each project has its own task queue
 * - Global limit on concurrent projects (default: 5)
 * - One task executes per project at a time
 * - Tasks from different projects can run concurrently
 * 
 * Usage:
 *   const queueManager = new ProjectQueueManager({ maxConcurrentProjects: 5 });
 *   await queueManager.enqueue('project-a', async () => { ... });
 *   queueManager.getStatus('project-a');
 */

import EventEmitter from 'events';

export class ProjectQueueManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.maxConcurrentProjects = options.maxConcurrentProjects || 5;
    this.defaultTimeout = options.defaultTimeout || 3600000; // 1 hour
    
    // State tracking
    this.projectQueues = new Map(); // project -> { queue: [], executing: false, current?: Task }
    this.activeTasks = new Map(); // taskId -> Task
    this.projectStats = new Map(); // project -> { completed, failed, running, queued }
    this.globalStats = { tasksEnqueued: 0, tasksCompleted: 0, tasksFailed: 0 };
    
    // Policy enforcement
    this.maxQueueSize = options.maxQueueSize || 1000;
  }

  /**
   * Enqueue a task for a specific project
   * @param {string} projectId
   * @param {Function} taskFn - async function to execute
   * @param {Object} options - { priority, timeout, label, onStart, onComplete, onError }
   * @returns {Promise} resolves with task result
   */
  async enqueue(projectId, taskFn, options = {}) {
    if (!projectId || typeof taskFn !== 'function') {
      throw new Error('Invalid project or task function');
    }

    // Get or create project queue
    if (!this.projectQueues.has(projectId)) {
      this.projectQueues.set(projectId, {
        queue: [],
        executing: false,
        current: null,
        startedAt: Date.now()
      });
      this.projectStats.set(projectId, {
        completed: 0,
        failed: 0,
        running: 0,
        queued: 0
      });
    }

    const queue = this.projectQueues.get(projectId);

    // Check queue size limit
    if (queue.queue.length >= this.maxQueueSize) {
      throw new Error(`Queue full for project ${projectId}`);
    }

    // Create task
    const taskId = `task_${projectId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const task = {
      id: taskId,
      projectId,
      fn: taskFn,
      priority: options.priority || 0,
      timeout: options.timeout || this.defaultTimeout,
      label: options.label || 'Task',
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
      status: 'queued',
      onStart: options.onStart,
      onComplete: options.onComplete,
      onError: options.onError,
      _resolve: null,
      _reject: null,
      _promise: null
    };

    // Create promise wrapper for task
    task._promise = new Promise((resolve, reject) => {
      task._resolve = resolve;
      task._reject = reject;
    });

    // Add to queue (maintain priority order)
    queue.queue.push(task);
    queue.queue.sort((a, b) => b.priority - a.priority);

    this.activeTasks.set(taskId, task);
    this.globalStats.tasksEnqueued++;
    
    const stats = this.projectStats.get(projectId);
    stats.queued++;

    this.emit('task:enqueued', {
      taskId,
      projectId,
      label: task.label,
      queueSize: queue.queue.length
    });

    // Start processing if not already running
    this._processQueue(projectId).catch(err => {
      console.error(`[ProjectQueue] Error processing ${projectId}:`, err);
    });

    return task._promise;
  }

  /**
   * Process queue for a specific project
   * @private
   */
  async _processQueue(projectId) {
    const queue = this.projectQueues.get(projectId);
    if (!queue || queue.executing) return;

    queue.executing = true;

    while (queue.queue.length > 0) {
      // Check global concurrency limit
      const activeProjectCount = Array.from(this.projectQueues.values())
        .filter(q => q.executing && q.current).length;

      if (activeProjectCount >= this.maxConcurrentProjects) {
        // Wait before checking again
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      // Get next task
      const task = queue.queue.shift();
      if (!task) break;

      queue.current = task;
      task.status = 'running';
      task.startedAt = Date.now();

      const stats = this.projectStats.get(projectId);
      stats.queued--;
      stats.running++;

      this.emit('task:started', {
        taskId: task.id,
        projectId,
        label: task.label
      });

      // Call user callback if provided
      if (task.onStart) {
        try {
          task.onStart(task);
        } catch (err) {
          console.error(`[ProjectQueue] onStart error for ${task.id}:`, err);
        }
      }

      // Execute task with timeout
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Task timeout after ${task.timeout}ms`)), task.timeout)
        );

        const result = await Promise.race([task.fn(), timeoutPromise]);

        task.result = result;
        task.status = 'completed';
        task.completedAt = Date.now();

        stats.completed++;
        stats.running--;

        this.emit('task:completed', {
          taskId: task.id,
          projectId,
          label: task.label,
          duration: task.completedAt - task.startedAt,
          result
        });

        // Call user callback
        if (task.onComplete) {
          try {
            task.onComplete(task);
          } catch (err) {
            console.error(`[ProjectQueue] onComplete error for ${task.id}:`, err);
          }
        }

        task._resolve(result);
      } catch (error) {
        task.error = error;
        task.status = 'failed';
        task.completedAt = Date.now();

        stats.failed++;
        stats.running--;

        this.globalStats.tasksFailed++;

        this.emit('task:failed', {
          taskId: task.id,
          projectId,
          label: task.label,
          duration: task.completedAt - task.startedAt,
          error: error.message
        });

        // Call user callback
        if (task.onError) {
          try {
            task.onError(task);
          } catch (err) {
            console.error(`[ProjectQueue] onError error for ${task.id}:`, err);
          }
        }

        task._reject(error);
      } finally {
        queue.current = null;
        this.activeTasks.delete(task.id);
        this.globalStats.tasksCompleted++;
      }
    }

    queue.executing = false;
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) return null;

    return {
      id: task.id,
      projectId: task.projectId,
      label: task.label,
      status: task.status,
      progress: task.status === 'running' ? (Date.now() - task.startedAt) : 0,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      result: task.result,
      error: task.error ? task.error.message : null
    };
  }

  /**
   * Get project status
   */
  getProjectStatus(projectId) {
    const queue = this.projectQueues.get(projectId);
    const stats = this.projectStats.get(projectId);

    if (!queue) return null;

    return {
      projectId,
      stats: { ...stats },
      queueSize: queue.queue.length,
      executing: queue.executing,
      currentTask: queue.current ? {
        id: queue.current.id,
        label: queue.current.label,
        elapsed: Date.now() - queue.current.startedAt
      } : null,
      nextTask: queue.queue[0] ? {
        id: queue.queue[0].id,
        label: queue.queue[0].label
      } : null
    };
  }

  /**
   * Get global status
   */
  getGlobalStatus() {
    const activeProjects = Array.from(this.projectQueues.entries())
      .filter(([_, q]) => q.executing || q.queue.length > 0)
      .map(([projectId, _]) => projectId);

    const concurrentTaskCount = Array.from(this.projectQueues.values())
      .filter(q => q.current).length;

    return {
      maxConcurrentProjects: this.maxConcurrentProjects,
      currentConcurrentProjects: concurrentTaskCount,
      activeProjects,
      projectCount: this.projectQueues.size,
      globalStats: { ...this.globalStats },
      allProjectStats: Object.fromEntries(this.projectStats),
      uptime: process.uptime()
    };
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) return false;

    if (task.status === 'queued') {
      const queue = this.projectQueues.get(task.projectId);
      const index = queue.queue.findIndex(t => t.id === taskId);
      if (index !== -1) {
        queue.queue.splice(index, 1);
        task.status = 'cancelled';
        const stats = this.projectStats.get(task.projectId);
        stats.queued--;
        task._reject(new Error('Task cancelled'));
        this.activeTasks.delete(taskId);
        return true;
      }
    }
    return false;
  }

  /**
   * Clear all queues for a project
   */
  clearProject(projectId) {
    const queue = this.projectQueues.get(projectId);
    if (!queue) return 0;

    const count = queue.queue.length;
    queue.queue = [];
    this.projectStats.delete(projectId);

    return count;
  }

  /**
   * Drain all queues (wait for completion)
   */
  async drain() {
    const promises = Array.from(this.projectQueues.entries())
      .map(([projectId, queue]) => {
        if (!queue.current && queue.queue.length === 0) {
          return Promise.resolve();
        }
        // Poll until queue is empty
        return new Promise(resolve => {
          const checkInterval = setInterval(() => {
            const q = this.projectQueues.get(projectId);
            if (!q || (!q.current && q.queue.length === 0)) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      });

    await Promise.all(promises);
  }
}

// Export singleton
let queueManagerInstance = null;

export function getQueueManager(options) {
  if (!queueManagerInstance) {
    queueManagerInstance = new ProjectQueueManager(options);
  }
  return queueManagerInstance;
}

export function resetQueueManager() {
  queueManagerInstance = null;
}
