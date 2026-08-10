/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  // Relative imports in src/ carry an explicit `.js` extension, which the ESM
  // build needs to resolve at runtime. Jest resolves against the TypeScript
  // sources, where that file does not exist, so map the extension away.
  // Without this, any module importing a sibling fails to load under test.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Tests are compiled against the test project, which is the one that pulls in
  // the Jest global types. The production tsconfig deliberately does not.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  // The suite currently sits at 100% on every metric; these are regression
  // floors with deliberate headroom, not targets.
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 95,
      functions: 90,
      lines: 90,
    },
  },
};
