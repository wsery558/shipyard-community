// OPEN SHIM: server.mjs expects `buildMarkdownReport` from ./src/core/report.mjs
// We alias to whatever open-core provides; otherwise return a safe placeholder string.

import * as M from "../../packages/open-core/src/core/report.mjs";

export function buildMarkdownReport(...args) {
  const fn =
    M.buildMarkdownReport ||
    M.buildReportMarkdown ||
    M.buildMarkdown ||
    M.buildReport;

  if (typeof fn === "function") return fn(...args);

  // Safe fallback (keeps server bootable even if report generator isn't shipped)
  return [
    "# Report",
    "",
    "(Open Core shim) Report generation is not available in this snapshot.",
    "",
    "This requires additional modules in the paid platform pack or a fuller core export.",
    "",
  ].join("\n");
}

// Re-export whatever open-core *does* export (keep existing API surface available)
export * from "../../packages/open-core/src/core/report.mjs";
