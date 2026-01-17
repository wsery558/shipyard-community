// OPEN SHIM: server.mjs expects `buildSummary` + `buildOfflineSummary` from ./src/core/summary.mjs
// We alias to open-core exports when present; otherwise provide safe fallbacks.

import * as M from "../../packages/open-core/src/core/summary.mjs";

export function buildSummary(...args) {
  const fn =
    M.buildSummary ||
    M.build_summary ||
    M.makeSummary ||
    M.summary ||
    M.default;
  if (typeof fn === "function") return fn(...args);
  return "(Open Core shim) Summary is not available in this snapshot.";
}

export function buildOfflineSummary(...args) {
  const fn =
    M.buildOfflineSummary ||
    M.build_offline_summary ||
    M.makeOfflineSummary ||
    M.offlineSummary;
  if (typeof fn === "function") return fn(...args);

  // Safe offline fallback (keeps server bootable)
  return "(Open Core shim) Offline summary is not available in this snapshot.";
}

// Re-export anything else open-core provides
export * from "../../packages/open-core/src/core/summary.mjs";
