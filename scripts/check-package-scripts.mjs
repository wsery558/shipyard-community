import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Check local entry files and explicit `pnpm run` aliases, without running them. */
export function checkPackageScripts(rootDir, manifest) {
  const scripts = manifest.scripts || {};
  const errors = [];
  for (const [name, command] of Object.entries(scripts)) {
    if (typeof command !== 'string') {
      errors.push(`${name}: command must be a string`);
      continue;
    }
    const localFiles = command.matchAll(/(?:^|\s)["']?([\w./-]+\.(?:mjs|cjs|js|sh))(?=["'\s]|$)/g);
    for (const [, file] of localFiles) {
      const absolute = path.resolve(rootDir, file);
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
        errors.push(`${name}: missing local file ${file}`);
      }
    }
    for (const [, target] of command.matchAll(/\bpnpm(?:\s+-[a-z]+)*\s+run\s+([\w:-]+)/g)) {
      if (!Object.hasOwn(scripts, target)) {
        errors.push(`${name}: missing package script ${target}`);
      }
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const errors = checkPackageScripts(process.cwd(), manifest);
    if (errors.length) {
      console.error(errors.join('\n'));
      process.exitCode = 1;
    } else {
      console.log(`Package scripts OK: ${Object.keys(manifest.scripts || {}).length} entries checked.`);
    }
  } catch (error) {
    console.error(`Package script check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
