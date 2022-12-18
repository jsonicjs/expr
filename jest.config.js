module.exports = {
  coveragePathIgnorePatterns: ['test'],
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  watchPathIgnorePatterns: ['.*.js$'],
  transform: {
    "^.+\\.tsx?$": "es-jest"
  },
};
