/**
 * CommandHeartbeat - simple heartbeat timer for command execution
 * Emits progress events at regular intervals while command is running.
 */
export class CommandHeartbeat {
  constructor(thresholdMs = 8000, intervalMs = 5000) {
    this.thresholdMs = thresholdMs;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.startTime = null;
  }

  start(onProgress) {
    this.startTime = Date.now();
    const checkProgress = () => {
      const elapsed = Date.now() - this.startTime;
      if (elapsed >= this.thresholdMs) {
        onProgress?.({ elapsed });
      }
      this.timer = setTimeout(checkProgress, this.intervalMs);
    };
    
    this.timer = setTimeout(checkProgress, this.thresholdMs);
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  reset() {
    this.stop();
    this.startTime = null;
  }
}
