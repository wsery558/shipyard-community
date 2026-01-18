// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/storage.mjs -> packages/open-core/src/core/storage.mjs (if present)

import * as M from "../../packages/open-core/src/core/storage.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const getStorageClient = M.getStorageClient ?? ((...args) => _openStub('getStorageClient', args));
export const initializeStorage = M.initializeStorage ?? ((...args) => _openStub('initializeStorage', args));

export * from "../../packages/open-core/src/core/storage.mjs";
