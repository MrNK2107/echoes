// jest-expo auto-mocks expo-crypto's native module, which makes randomUUID() return undefined.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID() as string,
}));
