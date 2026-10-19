import { expoPush } from './expoPush';

jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null, executionEnvironment: 'standalone', expoConfig: { extra: { eas: { projectId: 'p' } } } },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));

const mockRemove = jest.fn();
let mockListener: ((r: unknown) => void) | undefined;
const mockLast = jest.fn();
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getLastNotificationResponseAsync: (...a: unknown[]) => mockLast(...a),
  addNotificationResponseReceivedListener: (cb: (r: unknown) => void) => {
    mockListener = cb;
    return { remove: mockRemove };
  },
}));

const response = (identifier: string, data: Record<string, unknown>) => ({
  notification: { request: { identifier, content: { data } } },
});

describe('expoPush responses', () => {
  it('delivers a cold-start tap once even when the listener reports the same response', async () => {
    mockLast.mockResolvedValue(response('id-1', { type: 'memoryTagged', memoryId: 7 }));
    const cb = jest.fn();
    expoPush.onResponse(cb);
    await new Promise((r) => setTimeout(r, 0));
    mockListener?.(response('id-1', { type: 'memoryTagged', memoryId: 7 }));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ type: 'memoryTagged', memoryId: '7' });
    mockListener?.(response('id-2', { type: 'communityInvite' }));
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('does not replay the cold-start response when the screen subscribes again', async () => {
    const cb = jest.fn();
    expoPush.onResponse(cb);
    await new Promise((r) => setTimeout(r, 0));
    expect(cb).not.toHaveBeenCalled();
  });
});
