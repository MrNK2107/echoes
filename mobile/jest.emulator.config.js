// Runs the backend contract suites against the Firebase emulators (auth 9099, firestore 8080,
// storage 9199). Invoke from the repo root via:
//   npx firebase emulators:exec --project demo-echoes --only auth,firestore,storage "npm --prefix mobile run test:emulator"
const expoPreset = require('jest-expo/jest-preset');

const JS_TS = '\\.[jt]sx?$';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.emulator.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  transform: { [JS_TS]: expoPreset.transform[JS_TS] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  // waitFor polls for up to 10 s; emulator round-trips are slow, so leave generous headroom.
  testTimeout: 30000,
};
