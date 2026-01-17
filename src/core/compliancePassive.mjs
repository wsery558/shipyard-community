// OPEN STUB: passive compliance is paid-platform only in Open Core distribution.
export function getPassiveComplianceStatus() {
  return {
    ok: false,
    mode: "open_stub",
    reason: "Passive compliance is not available in Open Core. Requires paid-platform module.",
  };
}
