// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/autoVerify.mjs -> packages/open-core/src/core/autoVerify.mjs (if present)

import * as M from "../../packages/open-core/src/core/autoVerify.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const detectVerifyCmds = M.detectVerifyCmds ?? ((...args) => _openStub('detectVerifyCmds', args));
export const runVerification = M.runVerification ?? ((...args) => _openStub('runVerification', args));

export * from "../../packages/open-core/src/core/autoVerify.mjs";
