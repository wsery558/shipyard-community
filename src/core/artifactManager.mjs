// AUTO-GENERATED OPEN SHIM
// Keeps server.mjs bootable in open distribution.
// Maps ./src/core/artifactManager.mjs -> packages/open-core/src/core/artifactManager.mjs (if present)

import * as M from "../../packages/open-core/src/core/artifactManager.mjs";

function _openStub(name, args) {
  return { ok: false, mode: 'open_stub', name, args, reason: 'Not available in Open Core (missing or requires paid-platform).' };
}

export const cleanupArtifacts = M.cleanupArtifacts ?? ((...args) => _openStub('cleanupArtifacts', args));

export * from "../../packages/open-core/src/core/artifactManager.mjs";
