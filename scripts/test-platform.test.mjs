import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runPlatformChecks } from './test-platform.mjs';

test('runs every platform suite from the repository root', () => {
  const calls = [];
  const result = runPlatformChecks((command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0 };
  });
  assert.equal(result, 0);
  assert.deepEqual(calls.map(call => call.args), [
    ['--filter', 'api', 'test', '--runInBand'],
    ['--filter', 'web', 'test'],
    ['--filter', '@daftar/operations', 'test'],
    ['--test', 'apps/mobile/test/dependency-security.test.cjs', 'supabase/functions/api/activation-analytics.test.cjs', 'supabase/functions/api/material-create.test.cjs'],
    ['--filter', '@daftar/mobile', 'type-check'],
  ]);
  assert.ok(calls.every(call => call.options.cwd === fileURLToPath(new URL('../', import.meta.url)) && !call.options.shell));
});

for (const failure of [{ status: 1 }, { status: null, signal: 'SIGTERM' }, { error: new Error('missing executable') }]) {
  test(`returns failure and continues other suites: ${failure.signal || failure.error?.message || failure.status}`, () => {
    let count = 0;
    assert.equal(runPlatformChecks(() => ++count === 1 ? failure : { status: 0 }), 1);
    assert.equal(count, 5);
  });
}
