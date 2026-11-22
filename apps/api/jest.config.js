module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  coverageDirectory: '../coverage',
  // Measure every source file, not only the files a test happens to import.
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!main.ts'],
  // Ratchet floor raised from the 2026-11-22 baseline (#72), measured without
  // src/domain. Raise these as tests land; never lower them to make a PR pass.
  coverageThreshold: {
    global: { statements: 11, branches: 17, functions: 6, lines: 11 },
    // Domain logic has its own target (#72, AgDR-0001). Files under this path
    // are scored here and no longer count toward the global floor.
    // Jest resolves this key from the package root, not from rootDir.
    './src/domain/': { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
  testEnvironment: 'node',
};
