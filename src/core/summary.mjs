// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/summary.mjs -> packages/open-core/src/core/summary.mjs (if present)

import * as M from "../../packages/open-core/src/core/summary.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const buildSummary = M.buildSummary ?? ((...args) => _openStub('buildSummary', args));
export const buildOfflineSummary = M.buildOfflineSummary ?? ((...args) => _openStub('buildOfflineSummary', args));

export * from "../../packages/open-core/src/core/summary.mjs";
