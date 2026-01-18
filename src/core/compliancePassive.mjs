// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/compliancePassive.mjs -> packages/open-core/src/core/compliancePassive.mjs (if present)

const M = {};

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const getPassiveComplianceStatus = M.getPassiveComplianceStatus ?? ((...args) => _openStub('getPassiveComplianceStatus', args));

