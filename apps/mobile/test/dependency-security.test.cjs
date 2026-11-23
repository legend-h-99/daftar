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
// Metro 0.87 parses image sizes itself (src/lib/imageSize.js) and no longer
// depends on image-size. Resolve image-size only when Metro declares it, so a
// stray copy outside the workspace is never the one under test.
const metroPkg = metro('./package.json');
const imagePath = metroPkg.dependencies?.['image-size'] ? metro.resolve('image-size') : null;
const metroImageSize = metro.resolve('./src/lib/imageSize.js');

// expo-router 58 bundles its own navigation and no longer installs
// @react-navigation/native or query-string. Check the parser only when present.
function resolveQueryString() {
  try {
    const navigation = createRequire(router.resolve('@react-navigation/native/package.json'));
    const core = createRequire(navigation.resolve('@react-navigation/core/package.json'));
    return core.resolve('query-string');
  } catch {
    return null;
  }
}
const queryPath = resolveQueryString();

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

test('malformed zero-length image containers cannot hang the parser', (t) => {
  if (!imagePath) return t.skip('Metro no longer depends on image-size');
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

test('navigation parses Arabic links and bounded malformed percent input', (t) => {
  if (!queryPath) return t.skip('expo-router no longer depends on query-string');
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

test("Metro's own image parser rejects malformed headers without hanging", () => {
  const result = spawnSync(process.execPath, ['-e', `
    const { getImageDimensions } = require(process.argv[1]);
    const inputs = [
      ['jpg', Buffer.from('ffd8ffe00000', 'hex')],
      ['jpg', Buffer.concat([Buffer.from('ffd8', 'hex'), Buffer.alloc(64, 0xff)])],
      ['png', Buffer.from('89504e470d0a1a0a', 'hex')],
      ['gif', Buffer.from('474946', 'hex')],
      ['bmp', Buffer.from('424d', 'hex')],
    ];
    for (const [type, input] of inputs) { try { getImageDimensions(type, input, 'x.' + type); } catch {} }
  `, metroImageSize], { timeout: 3000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
