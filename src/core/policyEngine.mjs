// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/policyEngine.mjs -> packages/open-core/src/core/policyEngine.mjs (if present)

import * as M from "../../packages/open-core/src/core/policyEngine.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const getPolicyEngine = M.getPolicyEngine ?? ((...args) => _openStub('getPolicyEngine', args));

export * from "../../packages/open-core/src/core/policyEngine.mjs";
