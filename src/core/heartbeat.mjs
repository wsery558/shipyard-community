// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/heartbeat.mjs -> packages/open-core/src/core/heartbeat.mjs (if present)

import * as M from "../../packages/open-core/src/core/heartbeat.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const CommandHeartbeat = M.CommandHeartbeat ?? class CommandHeartbeat { constructor(...args){ this._open_stub=true; this._args=args; } };

export * from "../../packages/open-core/src/core/heartbeat.mjs";
