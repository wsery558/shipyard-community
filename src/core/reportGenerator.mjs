// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/reportGenerator.mjs -> packages/open-core/src/core/reportGenerator.mjs (if present)

import * as M from "../../packages/open-core/src/core/reportGenerator.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const generateAndStoreReport = M.generateAndStoreReport ?? ((...args) => _openStub('generateAndStoreReport', args));

export * from "../../packages/open-core/src/core/reportGenerator.mjs";
