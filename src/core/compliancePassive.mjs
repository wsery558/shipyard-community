// OPEN STUB: passive compliance is paid-platform only in Open Core distribution.
function _stub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Requires paid-platform module.' };
}

export function getPassiveComplianceStatus(...args) { return _stub('getPassiveComplianceStatus', args); }
