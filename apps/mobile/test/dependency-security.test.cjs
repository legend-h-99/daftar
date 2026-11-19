const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { readFile } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const mobile = createRequire(path.resolve(__dirname, '../package.json'));
const rn = createRequire(mobile.resolve('react-native/package.json'));
const cli = createRequire(rn.resolve('@react-native/community-cli-plugin/package.json'));
const metro = createRequire(cli.resolve('metro/package.json'));

test('Metro reads image dimensions from both buffers and asset paths', async () => {
  const { getAssetData, getAssetSize } = metro('./src/Assets.js');
  const file = path.resolve(__dirname, '../assets/icon.png');
  const buffer = await readFile(file);
  const size = getAssetSize('png', buffer, file);
  assert(size.width > 0 && size.height > 0);
  const data = await getAssetData(file, 'assets/icon.png', [], 'ios', '/assets');
  assert.equal(data.width, size.width);
  assert.equal(data.height, size.height);
});

// Expo SDK 58 no longer depends on @react-navigation, query-string or image-size, so the parsers that
// carried the image-size and decode-uri-component advisories are not locked. Check the lockfile that CI
// installs with --frozen-lockfile, rather than resolving from the machine: resolution walks up to the
// home directory and can find copies that are not part of this workspace.
test('the locked dependency graph has no image-size, query-string or decode-uri-component', async () => {
  const lock = await readFile(path.resolve(__dirname, '../../../pnpm-lock.yaml'), 'utf8');
  for (const name of ['image-size', 'query-string', 'decode-uri-component']) {
    assert.doesNotMatch(lock, new RegExp(`^\\s*'?/?${name}@`, 'm'), name);
  }
});
