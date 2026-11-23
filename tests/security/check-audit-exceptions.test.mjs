import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkExceptions, referencedIds, normaliseId, MAX_WINDOW_DAYS } from './check-audit-exceptions.mjs';

const ID = 'GHSA-fc5q-39xc-vjpf';
const entry = { id: ID, reason: 'build-time only', expires: '2026-12-17', owner: 'legend-h-99', ticket: '#79' };
const TODAY = '2026-11-17';

test('finds IDs in the block form', () => {
  assert.deepEqual(referencedIds(`auditConfig:\n  ignoreGhsas:\n    - ${ID}\n`), [ID]);
});

test('finds IDs in layouts a block parser would miss', () => {
  const layouts = [
    `auditConfig: { ignoreGhsas: [${ID}] }\n`,
    `auditConfig: # note\n  ignoreGhsas:\n\n    - ${ID}\n`,
    `"auditConfig":\r\n  "ignoreGhsas":\r\n    - "${ID}"\r\n`,
    `auditConfig:\n  ignoreGhsas:\n    - ${ID.toUpperCase()}\n`,
  ];
  for (const yaml of layouts) assert.deepEqual(referencedIds(yaml), [ID], yaml);
});

test('finds CVE IDs and IDs in package.json', () => {
  const pkg = JSON.stringify({ pnpm: { auditConfig: { ignoreCves: ['cve-2026-12345'] } } });
  assert.deepEqual(referencedIds('packages:\n  - "apps/*"\n', pkg), ['CVE-2026-12345']);
});

test('normalises GHSA and CVE IDs', () => {
  assert.equal(normaliseId(ID.toUpperCase()), ID);
  assert.equal(normaliseId('cve-2026-0001'), 'CVE-2026-0001');
});

test('a listed, unexpired exception passes', () => {
  assert.deepEqual(checkExceptions({ ignored: [ID], exceptions: [entry], today: TODAY }), []);
});

test('the expiry day itself still passes', () => {
  assert.deepEqual(checkExceptions({ ignored: [ID], exceptions: [entry], today: '2026-12-17' }), []);
});

test('an expired exception fails and names the owner', () => {
  const problems = checkExceptions({ ignored: [ID], exceptions: [entry], today: '2026-12-18' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /expired on 2026-12-17; legend-h-99 must re-assess/);
});

test('an ignored ID with no exception entry fails', () => {
  const problems = checkExceptions({ ignored: [ID, 'CVE-2026-12345'], exceptions: [entry], today: TODAY });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /CVE-2026-12345 appears in the pnpm config/);
});

test('an exception without expiry, reason or owner fails', () => {
  const problems = checkExceptions({ ignored: [ID], exceptions: [{ id: ID }], today: TODAY });
  assert.equal(problems.length, 3);
});

test('an impossible date fails', () => {
  for (const expires of ['2026-13-45', '2026-02-30', '2026-99-99']) {
    const problems = checkExceptions({ ignored: [ID], exceptions: [{ ...entry, expires }], today: TODAY });
    assert.equal(problems.length, 1, expires);
    assert.match(problems[0], /no valid expires date/);
  }
});

test(`an expiry more than ${MAX_WINDOW_DAYS} days ahead fails`, () => {
  const problems = checkExceptions({ ignored: [ID], exceptions: [{ ...entry, expires: '9999-12-31' }], today: TODAY });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /more than 90 days ahead/);
  assert.deepEqual(checkExceptions({ ignored: [ID], exceptions: [{ ...entry, expires: '2027-02-15' }], today: TODAY }), []);
});

test('a stale exception that is no longer ignored fails', () => {
  const problems = checkExceptions({ ignored: [], exceptions: [entry], today: TODAY });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not ignored/);
});
