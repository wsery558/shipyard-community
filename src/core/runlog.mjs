// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/runlog.mjs -> packages/open-core/src/core/runlog.mjs (if present)

import * as M from "../../packages/open-core/src/core/runlog.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const startRunSession = M.startRunSession ?? ((...args) => _openStub('startRunSession', args));
export const stopRunSession = M.stopRunSession ?? ((...args) => _openStub('stopRunSession', args));
export const getCurrentRunSessionId = M.getCurrentRunSessionId ?? ((...args) => _openStub('getCurrentRunSessionId', args));
export const logEvent = M.logEvent ?? ((...args) => _openStub('logEvent', args));
export const getRunEvents = M.getRunEvents ?? ((...args) => _openStub('getRunEvents', args));
export const getLatestRunSessionId = M.getLatestRunSessionId ?? ((...args) => _openStub('getLatestRunSessionId', args));
export const listRunSessions = M.listRunSessions ?? ((...args) => _openStub('listRunSessions', args));
export const truncateOutput = M.truncateOutput ?? ((...args) => _openStub('truncateOutput', args));
export const setEventCallback = M.setEventCallback ?? ((...args) => _openStub('setEventCallback', args));

export * from "../../packages/open-core/src/core/runlog.mjs";
