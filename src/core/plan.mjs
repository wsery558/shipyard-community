// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/plan.mjs -> packages/open-core/src/core/plan.mjs (if present)

import * as M from "../../packages/open-core/src/core/plan.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const mergePlans = M.mergePlans ?? ((...args) => _openStub('mergePlans', args));
export const computeProgress = M.computeProgress ?? ((...args) => _openStub('computeProgress', args));

export * from "../../packages/open-core/src/core/plan.mjs";
