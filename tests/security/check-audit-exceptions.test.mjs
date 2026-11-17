import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkExceptions, ignoredGhsas } from './check-audit-exceptions.mjs';

const ID = 'GHSA-fc5q-39xc-vjpf';
const entry = { ghsa: ID, reason: 'build-time only', expires: '2026-12-17', ticket: '#79' };

test('reads ignored GHSA IDs from the auditConfig block only', () => {
  const yaml = `packages:\n  - "apps/*"\n\nauditConfig:\n  ignoreGhsas:\n    - ${ID}\n\nother: GHSA-aaaa-bbbb-cccc\n`;
  assert.deepEqual(ignoredGhsas(yaml), [ID]);
});

test('no auditConfig block means nothing is ignored', () => {
  assert.deepEqual(ignoredGhsas('packages:\n  - "apps/*"\n'), []);
});

test('a listed, unexpired exception passes', () => {
  assert.deepEqual(checkExceptions({ ignored: [ID], exceptions: [entry], today: '2026-11-17' }), []);
});

test('the expiry day itself still passes', () => {
  assert.deepEqual(checkExceptions({ ignored: [ID], exceptions: [entry], today: '2026-12-17' }), []);
});

test('an expired exception fails', () => {
  const problems = checkExceptions({ ignored: [ID], exceptions: [entry], today: '2026-12-18' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /expired on 2026-12-17/);
});

test('an ignored GHSA with no exception entry fails', () => {
  const problems = checkExceptions({ ignored: [ID, 'GHSA-aaaa-bbbb-cccc'], exceptions: [entry], today: '2026-11-17' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /GHSA-aaaa-bbbb-cccc is ignored/);
});

test('an exception without an expiry or reason fails', () => {
  const problems = checkExceptions({ ignored: [ID], exceptions: [{ ghsa: ID }], today: '2026-11-17' });
  assert.equal(problems.length, 2);
});

test('a stale exception that is no longer ignored fails', () => {
  const problems = checkExceptions({ ignored: [], exceptions: [entry], today: '2026-11-17' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not ignored/);
});
