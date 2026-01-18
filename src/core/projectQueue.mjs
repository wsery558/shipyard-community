// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/projectQueue.mjs -> packages/open-core/src/core/projectQueue.mjs (if present)

import * as M from "../../packages/open-core/src/core/projectQueue.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const getQueueManager = M.getQueueManager ?? ((...args) => _openStub('getQueueManager', args));

export * from "../../packages/open-core/src/core/projectQueue.mjs";
