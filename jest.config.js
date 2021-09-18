module.exports = {
  transform: {
    "^.+\\.tsx?$": "esbuild-jest"
  },
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  watchPathIgnorePatterns: ['.*.js$'],
};
