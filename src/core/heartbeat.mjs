// OPEN SHIM: server.mjs expects `CommandHeartbeat`.
// We try to alias from open-core; if not present, provide a minimal no-op class to keep booting.

import * as M from "../../packages/open-core/src/core/heartbeat.mjs";

const Impl =
  M.CommandHeartbeat ??
  M.CommandHeartBeat ??
  M.Heartbeat ??
  M.default;

export const CommandHeartbeat = Impl ?? class CommandHeartbeat {
  constructor(..._args) {}
  beat() {}
  touch() {}
  tick() {}
  stop() {}
};

export * from "../../packages/open-core/src/core/heartbeat.mjs";
