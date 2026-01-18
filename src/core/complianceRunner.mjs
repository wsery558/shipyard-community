// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/complianceRunner.mjs -> packages/open-core/src/core/complianceRunner.mjs (if present)

import * as M from "../../packages/open-core/src/core/complianceRunner.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const runCompliance = M.runCompliance ?? ((...args) => _openStub('runCompliance', args));
export const getLatestComplianceStatus = M.getLatestComplianceStatus ?? ((...args) => _openStub('getLatestComplianceStatus', args));
export const getAllProjectsWithStatus = M.getAllProjectsWithStatus ?? ((...args) => _openStub('getAllProjectsWithStatus', args));
export const setEventCallbacks = M.setEventCallbacks ?? ((...args) => _openStub('setEventCallbacks', args));

export * from "../../packages/open-core/src/core/complianceRunner.mjs";
