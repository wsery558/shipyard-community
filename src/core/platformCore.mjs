// OPEN STUB: paid-platform only. Keep server.mjs bootable without shipping paid code.
// Generated from server.mjs import list (platformCore).

function _stub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Requires paid-platform module.' };
}

export function loadUsers(...args) { return _stub('loadUsers', args); }
export function getUserById(...args) { return _stub('getUserById', args); }
export function getUserEntitlements(...args) { return _stub('getUserEntitlements', args); }
export function grantEntitlement(...args) { return _stub('grantEntitlement', args); }
export function revokeEntitlement(...args) { return _stub('revokeEntitlement', args); }
export function appendEvent(...args) { return _stub('appendEvent', args); }
export function loadEvents(...args) { return _stub('loadEvents', args); }
export function calculateMetrics(...args) { return _stub('calculateMetrics', args); }
export function getPassiveComplianceStatus(...args) { return _stub('getPassiveComplianceStatus', args); }
export function getAllProductsComplianceStatus(...args) { return _stub('getAllProductsComplianceStatus', args); }
