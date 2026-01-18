// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/contextPack.mjs -> packages/open-core/src/core/contextPack.mjs (if present)

import * as M from "../../packages/open-core/src/core/contextPack.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const createContextSnapshot = M.createContextSnapshot ?? ((...args) => _openStub('createContextSnapshot', args));

export * from "../../packages/open-core/src/core/contextPack.mjs";
