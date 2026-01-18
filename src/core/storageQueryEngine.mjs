// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/storageQueryEngine.mjs -> packages/open-core/src/core/storageQueryEngine.mjs (if present)

import * as M from "../../packages/open-core/src/core/storageQueryEngine.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const getStorageQueryEngine = M.getStorageQueryEngine ?? ((...args) => _openStub('getStorageQueryEngine', args));

export * from "../../packages/open-core/src/core/storageQueryEngine.mjs";
