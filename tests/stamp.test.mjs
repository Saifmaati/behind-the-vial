// Deploys must never mix cached old modules with new ones: index.html's import map and asset links
// carry content hashes (tools/stamp.mjs). This fails when a file changed without re-stamping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('index.html cache-busting stamps match the current files (run node tools/stamp.mjs)', () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, ['tools/stamp.mjs', '--check'], { cwd: ROOT, stdio: 'pipe' }));
});
