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
const imagePath = metro.resolve('image-size');

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

test('malformed zero-length image containers cannot hang the parser', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const {imageSize} = require(process.argv[1]);
    const icns = Buffer.alloc(16); icns.write('icns');
    icns.writeUInt32BE(16,4); icns.write('icp4',8);
    const jxl = Buffer.from('0000000c4a584c200d0a870a00000000667479706a786c20','hex');
    for (const input of [icns,jxl]) { try { imageSize(input); } catch {} }
  `, imagePath], { timeout: 3000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

// Expo SDK 58 no longer depends on @react-navigation or query-string, so the parser that carried the
// decode-uri-component advisory is not installed. Assert that it stays out of the app's dependency
// graph, rather than requiring a chain that no longer exists.
test('the query-string parser behind the decode-uri-component advisory is not installed', () => {
  for (const name of ['query-string', 'decode-uri-component']) {
    assert.throws(() => mobile.resolve(`${name}/package.json`), { code: 'MODULE_NOT_FOUND' }, name);
  }
});
