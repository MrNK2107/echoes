import { waitFor } from '@testing-library/react-native';

import { fakeConnectivity, fakePush, testServices } from '@/device/fakes';

import { REGISTER_MIN_INTERVAL_MS, registerDevice, signOutDevice } from './pushDevice';

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

describe('registration throttle and offline retry', () => {
  const TOKEN = 'ExponentPushToken[t]';

  function setup(over: { failFirst?: boolean } = {}) {
    let clock = new Date('2026-10-19T09:00:00Z').getTime();
    const connectivity = fakeConnectivity(true);
    const unsubscribe = jest.fn();
    const listeners = new Set<(online: boolean) => void>();
    const subscribe = jest.spyOn(connectivity, 'subscribe').mockImplementation((cb) => {
      listeners.add(cb);
      return () => {
        unsubscribe();
        listeners.delete(cb);
      };
    });
    const push = fakePush({ permission: 'granted', token: TOKEN });
    const base = testServices({ push, connectivity, now: () => new Date(clock) });
    const register = jest.fn(base.repos.pushTokens.register);
    if (over.failFirst) register.mockRejectedValueOnce(new Error('offline'));
    const services = { ...base, repos: { ...base.repos, pushTokens: { ...base.repos.pushTokens, register } } };
    return {
      services,
      push,
      register,
      subscribe,
      unsubscribe,
      emitOnline: (online: boolean) => [...listeners].forEach((cb) => cb(online)),
      advance: (ms: number) => {
        clock += ms;
      },
    };
  }

  it('three foreground registrations within 6 h register once', async () => {
    const { services, register, advance } = setup();
    await registerDevice(services, 'A');
    advance(60_000);
    await registerDevice(services, 'A');
    advance(60 * 60 * 1000);
    await registerDevice(services, 'A');
    expect(register).toHaveBeenCalledTimes(1);
    advance(REGISTER_MIN_INTERVAL_MS);
    await registerDevice(services, 'A');
    expect(register).toHaveBeenCalledTimes(2);
  });

  it('registers again when the permission changed or the user is different', async () => {
    const { services, register, push } = setup();
    await registerDevice(services, 'A');
    await registerDevice(services, 'B');
    expect(register).toHaveBeenCalledTimes(2);
    push.setPermission('denied');
    await registerDevice(services, 'B');
    expect(register).toHaveBeenCalledTimes(3);
  });

  it('an offline failure retries once when the network comes back, then unsubscribes', async () => {
    const { services, register, subscribe, unsubscribe, emitOnline } = setup({ failFirst: true });
    await expect(registerDevice(services, 'A')).rejects.toThrow('offline');
    expect(subscribe).toHaveBeenCalledTimes(1);
    emitOnline(false);
    expect(register).toHaveBeenCalledTimes(1);
    emitOnline(true);
    await waitFor(() => expect(register).toHaveBeenCalledTimes(2));
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    emitOnline(true);
    expect(register).toHaveBeenCalledTimes(2);
  });

  it('sign-out cancels a pending retry', async () => {
    const { services, register, unsubscribe, emitOnline } = setup({ failFirst: true });
    await expect(registerDevice(services, 'A')).rejects.toThrow('offline');
    await signOutDevice(services, 'A');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    emitOnline(true);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('force registers despite the throttle', async () => {
    const { services, register } = setup();
    await registerDevice(services, 'A');
    await registerDevice(services, 'A', { force: true });
    expect(register).toHaveBeenCalledTimes(2);
  });

  it('concurrent calls share one in-flight attempt', async () => {
    const { services, register } = setup();
    await Promise.all([registerDevice(services, 'A'), registerDevice(services, 'A'), registerDevice(services, 'A')]);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('a forced call that joins a throttled in-flight attempt still registers', async () => {
    const { services, register } = setup();
    await registerDevice(services, 'A');
    const plain = registerDevice(services, 'A');
    const forced = registerDevice(services, 'A', { force: true });
    await Promise.all([plain, forced]);
    expect(register).toHaveBeenCalledTimes(2);
  });

  it('signing out and back in as the same user during an attempt registers in the new session', async () => {
    let release: (t: string | null) => void = () => {};
    let calls = 0;
    const push = fakePush({
      permission: 'granted',
      token: () => (++calls === 1 ? new Promise<string | null>((r) => (release = r)) : Promise.resolve(TOKEN)),
    });
    const base = testServices({ push });
    const register = jest.fn(base.repos.pushTokens.register);
    const services = { ...base, repos: { ...base.repos, pushTokens: { ...base.repos.pushTokens, register } } };
    const first = registerDevice(services, 'A');
    await signOutDevice(services, 'A');
    await registerDevice(services, 'A');
    release(TOKEN);
    await first;
    expect(register).toHaveBeenCalledTimes(1);
    expect(await base.repos.pushTokens.get('A', TOKEN)).not.toBeNull();
  });

  it('a failure while already waiting for the network does not subscribe twice', async () => {
    const { services, subscribe, register } = setup({ failFirst: true });
    await expect(registerDevice(services, 'A')).rejects.toThrow('offline');
    register.mockRejectedValueOnce(new Error('offline'));
    await expect(registerDevice(services, 'A')).rejects.toThrow('offline');
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});
