// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/budget.mjs -> packages/open-core/src/core/budget.mjs (if present)

import * as M from "../../packages/open-core/src/core/budget.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const checkBudgetExceeded = M.checkBudgetExceeded ?? ((...args) => _openStub('checkBudgetExceeded', args));

export * from "../../packages/open-core/src/core/budget.mjs";
