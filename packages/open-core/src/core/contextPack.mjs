import fs from 'fs';
import path from 'path';

/**
 * Minimal context snapshot generator used by PM context sync.
 * Returns an object with stats and small file list. Kept lightweight for smoke tests.
 */
export async function createContextSnapshot(repoRoot, opts = {}) {
  const maxFiles = opts.maxFiles || 10;
  const stats = { files: 0, bytes: 0 };
  const files = [];

  try {
    const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
    for (const e of entries) {
      if (files.length >= maxFiles) break;
      if (!e.isFile()) continue;
      const p = path.join(repoRoot, e.name);
      try {
        const st = fs.statSync(p);
        const content = fs.readFileSync(p, 'utf8').slice(0, 2000);
        files.push({ path: e.name, size: st.size, content });
        stats.files += 1;
        stats.bytes += st.size || 0;
      } catch (err) {}
    }
  } catch (err) {
    // ignore
  }

  return {
    type: 'CONTEXT_SNAPSHOT',
    stats,
    files
  };
}
