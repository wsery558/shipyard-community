// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/report.mjs -> packages/open-core/src/core/report.mjs (if present)

import * as M from "../../packages/open-core/src/core/report.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const buildMarkdownReport = M.buildMarkdownReport ?? ((...args) => _openStub('buildMarkdownReport', args));

export * from "../../packages/open-core/src/core/report.mjs";
