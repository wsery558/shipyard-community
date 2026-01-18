// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Source: packages/open-core/src/core/compliancePassive.mjs (if present)

const M = {};

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (requires paid-platform or missing in this snapshot).' };
}

export const getPassiveComplianceStatus = M.getPassiveComplianceStatus ?? ((...args) => _openStub('getPassiveComplianceStatus', args));

