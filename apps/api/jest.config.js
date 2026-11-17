module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  coverageDirectory: '../coverage',
  // Measure every source file, not only the files a test happens to import.
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!main.ts'],
  // Ratchet floor set from the 2026-11-17 baseline (#72). Raise these as tests
  // land; never lower them to make a PR pass.
  coverageThreshold: {
    global: { statements: 7, branches: 9, functions: 4, lines: 7 },
  },
  testEnvironment: 'node',
};
