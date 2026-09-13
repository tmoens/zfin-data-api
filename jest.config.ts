module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  preset: 'ts-jest',
  rootDir: '.',
  testRegex: '.spec.ts$',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  // Count EVERY source file, not only the ones a test happened to import. Jest's default reports
  // on touched files alone, which makes coverage look high precisely when it is worst — an entirely
  // untested file simply does not appear in the table.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/testing/**',
    // Generated DDL, executed against a real database by the migration CLI, not by jest.
    '!src/migrations/**',
    // Process entry points: these bootstrap Nest and exit. What is worth asserting about them lives
    // in the units they wire together, which are covered directly.
    '!src/main.ts',
    '!src/loader.ts',
    '!src/instrument.ts',
    '!src/data-source.ts',
    // Declaration-only DI wiring.
    '!src/**/*.module.ts',
  ],
  coverageDirectory: './coverage',
};
