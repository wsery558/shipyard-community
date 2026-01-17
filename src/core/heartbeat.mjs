// AUTO-SHIM (open-core): legacy src/core -> packages/open-core
// Compatibility: ensure named export CommandHeartbeat exists for server.mjs

import * as HB from "../../packages/open-core/src/core/heartbeat.mjs";
export * from "../../packages/open-core/src/core/heartbeat.mjs";

/**
 * Fallback implementation (only used if open-core doesn't export CommandHeartbeat)
 * Provides a minimal heartbeat utility to keep server bootable in Open Core.
 */
class _FallbackCommandHeartbeat {
  constructor(opts = {}) {
    const { timeoutMs = 30_000, now = () => Date.now() } = opts;
    this._timeoutMs = Number(timeoutMs) || 30_000;
    this._now = now;
    this._lastBeatAt = this._now();
    this._lastLabel = "";
  }
  beat(label = "") {
    this._lastBeatAt = this._now();
    this._lastLabel = String(label ?? "");
  }
  tick(label = "") { this.beat(label); }
  touch(label = "") { this.beat(label); }
  ageMs() { return this._now() - this._lastBeatAt; }
  isStale() { return this.ageMs() > this._timeoutMs; }
  toJSON() {
    return {
      lastBeatAt: this._lastBeatAt,
      ageMs: this.ageMs(),
      timeoutMs: this._timeoutMs,
      lastLabel: this._lastLabel,
      stale: this.isStale(),
      impl: "fallback",
    };
  }
}

// Prefer real implementation from open-core if present; else default/Heartbeat; else fallback.
export const CommandHeartbeat =
  HB.CommandHeartbeat ??
  HB.default ??
  HB.Heartbeat ??
  _FallbackCommandHeartbeat;

