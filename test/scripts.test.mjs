import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkPackageScripts } from '../scripts/check-package-scripts.mjs';

function fixture(t, scripts, files = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shipyard-scripts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts }));
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), '');
  }
  return root;
}

test('the shipped manifest references existing entry files and package scripts', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.deepEqual(checkPackageScripts(root, manifest), []);
});

test('valid node entries, a Vite config and chained aliases pass', t => {
  const scripts = { test: 'pnpm run unit && pnpm -s run build', unit: 'node --test test/core.test.mjs', build: 'vite build --config ui/vite.config.js' };
  const root = fixture(t, scripts, ['test/core.test.mjs', 'ui/vite.config.js']);
  assert.deepEqual(checkPackageScripts(root, { scripts }), []);
});

for (const [name, command, missing] of [
  ['Node entry', 'node scripts/missing.mjs', 'scripts/missing.mjs'],
  ['shell entry', 'bash scripts/missing.sh', 'scripts/missing.sh'],
  ['Vite config', 'vite build --config ui/missing.js', 'ui/missing.js']
]) {
  test(`a missing ${name} fails validation`, t => {
    const scripts = { check: command };
    const root = fixture(t, scripts);
    assert.deepEqual(checkPackageScripts(root, { scripts }), [`check: missing local file ${missing}`]);
  });
}

test('a dangling package-script alias fails validation', t => {
  const scripts = { test: 'pnpm run absent' };
  const root = fixture(t, scripts);
  assert.deepEqual(checkPackageScripts(root, { scripts }), ['test: missing package script absent']);
});

test('a non-string script fails validation', t => {
  const scripts = { test: 42 };
  const root = fixture(t, scripts);
  assert.deepEqual(checkPackageScripts(root, { scripts }), ['test: command must be a string']);
});

test('the CLI exits nonzero on an invalid manifest and zero on a valid one', t => {
  const root = fixture(t, { test: 'node absent.mjs' });
  const checker = fileURLToPath(new URL('../scripts/check-package-scripts.mjs', import.meta.url));
  const invalid = spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /missing local file absent.mjs/);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node present.mjs' } }));
  fs.writeFileSync(path.join(root, 'present.mjs'), '');
  const valid = spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
  assert.equal(valid.status, 0);
  assert.match(valid.stdout, /1 entries checked/);
});
