const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { existsSync, readFileSync } = require('node:fs');
const { readFile } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Some packages block "package.json" subpaths through "exports", so find each
// package root by walking up from its entry point.
function packageRequire(name, from) {
  let dir = path.dirname(from.resolve(name));
  for (;;) {
    const manifest = path.join(dir, 'package.json');
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name === name) {
      return createRequire(manifest);
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`package root not found: ${name}`);
    dir = parent;
  }
}

const mobile = createRequire(path.resolve(__dirname, '../package.json'));
const rn = packageRequire('react-native', mobile);
const cli = packageRequire('@react-native/community-cli-plugin', rn);
const metro = packageRequire('metro', cli);
// SDK 58 ships Metro's own image parser; the external image-size package is gone.
const imageParserPath = metro.resolve('./src/lib/imageSize.js');
const lockPath = path.resolve(__dirname, '../../../pnpm-lock.yaml');

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
    const {getImageDimensions} = require(process.argv[1]);
    const icns = Buffer.alloc(16); icns.write('icns');
    icns.writeUInt32BE(16,4); icns.write('icp4',8);
    const jxl = Buffer.from('0000000c4a584c200d0a870a00000000667479706a786c20','hex');
    for (const [type, input] of [['icns',icns],['jxl',jxl]]) { try { getImageDimensions(type, input, 'asset.'+type); } catch {} }
  `, imageParserPath], { timeout: 3000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('SDK 53 parser workarounds are no longer in the dependency tree', async () => {
  const lock = await readFile(lockPath, 'utf8');
  assert.doesNotMatch(lock, /^\s+image-size@/m);
  assert.doesNotMatch(lock, /^\s+query-string@/m);
});
