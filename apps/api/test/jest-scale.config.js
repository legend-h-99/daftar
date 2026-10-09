// Isolated Jest config for the scale/load behavior spec (test/scale/).
// Kept separate from ../jest.config.js on purpose: that config's rootDir is
// `src`, so it never picks these files up, and the default `pnpm test` run
// (and CI) never depends on the scale-test fixture being seeded.
//
// Run: pnpm --filter api test:scale
module.exports = {
  rootDir: '..',
  testRegex: 'test/scale/.*\\.e2e-spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  testTimeout: 30000,
};
