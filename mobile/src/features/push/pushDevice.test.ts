import { fakePush, testServices } from '@/device/fakes';

import { registerDevice, signOutDevice } from './pushDevice';

describe('pushDevice', () => {
  it('a registration in flight when sign-out happens leaves no token and no stale cache', async () => {
    let release: (t: string | null) => void = () => {};
    const lookup = new Promise<string | null>((r) => (release = r));
    const push = fakePush({ permission: 'granted', token: () => lookup });
    const services = testServices({ push });
    const inflight = registerDevice(services, 'A');
    await signOutDevice(services, 'A');
    release('ExponentPushToken[shared]');
    await inflight;
    expect(await services.repos.pushTokens.get('A', 'ExponentPushToken[shared]')).toBeNull();
    // The next user's sign-out does not trip over A's leftovers.
    await expect(signOutDevice(services, 'B')).resolves.toBeUndefined();
  });

  it('a registration whose write lands after sign-out is unregistered again', async () => {
    const push = fakePush({ permission: 'granted', token: 'ExponentPushToken[shared]' });
    const base = testServices({ push });
    let finishWrite: () => void = () => {};
    const register = base.repos.pushTokens.register;
    const repos = {
      ...base.repos,
      pushTokens: {
        ...base.repos.pushTokens,
        register: async (...a: Parameters<typeof register>) => {
          await new Promise<void>((r) => (finishWrite = r));
          return register(...a);
        },
      },
    };
    const services = { ...base, repos };
    const inflight = registerDevice(services, 'A');
    await new Promise((r) => setTimeout(r, 0));
    await signOutDevice(services, 'A');
    finishWrite();
    await inflight;
    expect(await repos.pushTokens.get('A', 'ExponentPushToken[shared]')).toBeNull();
  });

  it('sign-out ignores a cached token of another uid and looks the token up again', async () => {
    const push = fakePush({ permission: 'granted', token: 'ExponentPushToken[t]' });
    const services = testServices({ push });
    await registerDevice(services, 'A');
    await services.repos.pushTokens.register('B', 'ExponentPushToken[t]', 'ios', services.now());
    await signOutDevice(services, 'B');
    expect(await services.repos.pushTokens.get('B', 'ExponentPushToken[t]')).toBeNull();
  });

  it('sign-out completes within the timeout when the token lookup never resolves', async () => {
    jest.useFakeTimers();
    try {
      const push = fakePush({ permission: 'granted', token: () => new Promise<string | null>(() => {}) });
      const services = testServices({ push });
      const done = jest.fn();
      const pending = signOutDevice(services, 'A').then(done);
      await jest.advanceTimersByTimeAsync(2900);
      expect(done).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(200);
      await pending;
      expect(done).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
