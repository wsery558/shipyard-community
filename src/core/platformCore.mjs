// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/platformCore.mjs -> packages/open-core/src/core/platformCore.mjs (if present)

const M = {};

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const loadUsers = M.loadUsers ?? ((...args) => _openStub('loadUsers', args));
export const getUserById = M.getUserById ?? ((...args) => _openStub('getUserById', args));
export const getUserEntitlements = M.getUserEntitlements ?? ((...args) => _openStub('getUserEntitlements', args));
export const grantEntitlement = M.grantEntitlement ?? ((...args) => _openStub('grantEntitlement', args));
export const revokeEntitlement = M.revokeEntitlement ?? ((...args) => _openStub('revokeEntitlement', args));
export const appendEvent = M.appendEvent ?? ((...args) => _openStub('appendEvent', args));
export const loadEvents = M.loadEvents ?? ((...args) => _openStub('loadEvents', args));
export const calculateMetrics = M.calculateMetrics ?? ((...args) => _openStub('calculateMetrics', args));
export const getPassiveComplianceStatus = M.getPassiveComplianceStatus ?? ((...args) => _openStub('getPassiveComplianceStatus', args));
export const getAllProductsComplianceStatus = M.getAllProductsComplianceStatus ?? ((...args) => _openStub('getAllProductsComplianceStatus', args));

