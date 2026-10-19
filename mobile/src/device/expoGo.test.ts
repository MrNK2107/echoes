/* eslint-disable @typescript-eslint/no-require-imports -- jest.doMock needs lazy require */
function withConstants(c: object) {
  jest.resetModules();
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: c,
    ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' },
  }));
  return require('./expoGo').isExpoGo as () => boolean;
}

describe('isExpoGo', () => {
  afterEach(() => {
    jest.dontMock('expo-constants');
    jest.resetModules();
  });

  it('is true for the store client or an expo appOwnership', () => {
    expect(withConstants({ executionEnvironment: 'storeClient' })()).toBe(true);
    expect(withConstants({ appOwnership: 'expo' })()).toBe(true);
  });

  it('is false in a standalone or bare build', () => {
    expect(withConstants({ executionEnvironment: 'standalone' })()).toBe(false);
    expect(withConstants({ executionEnvironment: 'bare', appOwnership: null })()).toBe(false);
  });
});
