/**
 * Stall Watchdog - detects long-running or idle commands and emits stall signals
 * 
 * Features:
 * - Total runtime threshold (STALL_THRESHOLD_MS, default 45s)
 * - Idle threshold (STALL_IDLE_MS, default 15s) - no progress heartbeat
 * - Debounced per-command (single stall emission until cleared)
 * - Callbacks for stall events
 */

export class StallWatchdog {
  constructor(options = {}) {
    this.stallThresholdMs = options.stallThresholdMs || parseInt(process.env.STALL_THRESHOLD_MS || '45000', 10);
    this.stallIdleMs = options.stallIdleMs || parseInt(process.env.STALL_IDLE_MS || '15000', 10);
    
    // Per-command state
    this.commands = new Map(); // commandId -> { startTime, lastProgressAt, stallEmitted, timers }
  }

  /**
   * Start watching a command
   * @param {string} commandId - unique command identifier
   * @param {object} callbacks - { onStall: (info) => void }
   */
  startWatching(commandId, callbacks = {}) {
    if (this.commands.has(commandId)) {
      this.stopWatching(commandId);
    }

    const now = Date.now();
    const state = {
      startTime: now,
      lastProgressAt: now,
      stallEmitted: false,
      timers: { runtime: null, idle: null },
      callbacks
    };

    // Runtime timer - triggers after stallThresholdMs
    state.timers.runtime = setTimeout(() => {
      this._emitStall(commandId, 'runtime_exceeded');
    }, this.stallThresholdMs);

    // Idle timer - triggers after stallIdleMs of no progress
    state.timers.idle = setTimeout(() => {
      this._checkIdleStall(commandId);
    }, this.stallIdleMs);

    this.commands.set(commandId, state);
  }

  /**
   * Record progress for a command (resets idle timer)
   */
  recordProgress(commandId) {
    const state = this.commands.get(commandId);
    if (!state) return;

    state.lastProgressAt = Date.now();

    // Reset idle timer
    if (state.timers.idle) {
      clearTimeout(state.timers.idle);
    }
    state.timers.idle = setTimeout(() => {
      this._checkIdleStall(commandId);
    }, this.stallIdleMs);
  }

  /**
   * Clear stall flag for a command (allows re-emission)
   */
  clearStall(commandId) {
    const state = this.commands.get(commandId);
    if (state) {
      state.stallEmitted = false;
    }
  }

  /**
   * Stop watching a command
   */
  stopWatching(commandId) {
    const state = this.commands.get(commandId);
    if (!state) return;

    if (state.timers.runtime) clearTimeout(state.timers.runtime);
    if (state.timers.idle) clearTimeout(state.timers.idle);

    this.commands.delete(commandId);
  }

  /**
   * Get stall info for a command
   */
  getStallInfo(commandId) {
    const state = this.commands.get(commandId);
    if (!state) return null;

    const now = Date.now();
    return {
      commandId,
      startTime: state.startTime,
      lastProgressAt: state.lastProgressAt,
      elapsedMs: now - state.startTime,
      idleMs: now - state.lastProgressAt,
      stallEmitted: state.stallEmitted
    };
  }

  // Internal methods
  _checkIdleStall(commandId) {
    const state = this.commands.get(commandId);
    if (!state) return;

    const now = Date.now();
    const idleMs = now - state.lastProgressAt;

    if (idleMs >= this.stallIdleMs) {
      this._emitStall(commandId, 'idle_timeout');
    }
  }

  _emitStall(commandId, reason) {
    const state = this.commands.get(commandId);
    if (!state || state.stallEmitted) return;

    state.stallEmitted = true;

    const now = Date.now();
    const info = {
      commandId,
      reason,
      elapsedMs: now - state.startTime,
      idleMs: now - state.lastProgressAt,
      lastProgressAt: state.lastProgressAt,
      hint: reason === 'runtime_exceeded' 
        ? `Command running for ${Math.round((now - state.startTime) / 1000)}s`
        : `No progress for ${Math.round((now - state.lastProgressAt) / 1000)}s`
    };

    state.callbacks.onStall?.call(null, info);
  }
}

// Singleton instance
let _instance = null;

export function getStallWatchdog(options) {
  if (!_instance) {
    _instance = new StallWatchdog(options);
  }
  return _instance;
}
