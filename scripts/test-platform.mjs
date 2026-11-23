import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const suites = [
  ['API', 'pnpm', ['--filter', 'api', 'test', '--runInBand']],
  ['Web', 'pnpm', ['--filter', 'web', 'test']],
  ['Operations', 'pnpm', ['--filter', '@daftar/operations', 'test']],
  ['Edge and mobile regression tests', process.execPath, ['--test', 'apps/mobile/test/dependency-security.test.cjs', 'supabase/functions/api/activation-analytics.test.cjs', 'supabase/functions/api/material-create.test.cjs', 'supabase/functions/api/otp-limits.test.cjs']],
  ['Mobile types', 'pnpm', ['--filter', '@daftar/mobile', 'type-check']],
];

export function runPlatformChecks(run = spawnSync) {
  let failed = false;
  for (const [name, command, args] of suites) {
    console.log(`\nRunning: ${name}`);
    const result = run(command, args, { cwd: root, stdio: 'inherit', shell: false });
    if (result.error || result.status !== 0) {
      failed = true;
      console.error(`FAILED: ${name}${result.error ? ` (${result.error.message})` : ''}`);
    } else {
      console.log(`PASSED: ${name}`);
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runPlatformChecks();
}
