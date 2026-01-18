// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/safety.mjs -> packages/open-core/src/core/safety.mjs (if present)

import * as M from "../../packages/open-core/src/core/safety.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const isDangerousBash = M.isDangerousBash ?? ((...args) => _openStub('isDangerousBash', args));

export * from "../../packages/open-core/src/core/safety.mjs";
