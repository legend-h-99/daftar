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
const router = createRequire(mobile.resolve('expo-router/package.json'));
const navigation = createRequire(router.resolve('@react-navigation/native/package.json'));
const core = createRequire(navigation.resolve('@react-navigation/core/package.json'));
const imagePath = metro.resolve('image-size');
const queryPath = core.resolve('query-string');

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

test('navigation parses Arabic links and bounded malformed percent input', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const query = require(process.argv[1]);
    assert.equal(query.parse('name=%D8%AF%D9%81%D8%AA%D8%B1').name,'دفتر');
    assert.equal(query.parse('q=a+b').q,'a b');
    assert.equal(typeof query.parse('q='+('%E0%A4%A'+'%41').repeat(10000)).q,'string');
  `, queryPath], { timeout: 5000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
