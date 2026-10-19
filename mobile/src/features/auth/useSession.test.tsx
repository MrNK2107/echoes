import { act, renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { useSession } from './useSession';

const wrap = (services: Services) =>
  function Wrapper({ children }: { children: ReactNode }) {
    // eslint-disable-next-line react/no-children-prop
    return createElement(ServicesProvider, { services, children });
  };

/** Counts open auth subscriptions (subscribe calls minus unsubscribes). */
function counted() {
  const services = testServices();
  const state = { calls: 0, open: 0 };
  const original = services.repos.auth.subscribe;
  jest.spyOn(services.repos.auth, 'subscribe').mockImplementation((cb) => {
    state.calls += 1;
    state.open += 1;
    const off = original(cb);
    let done = false;
    return () => {
      if (!done) {
        done = true;
        state.open -= 1;
      }
      off();
    };
  });
  return { services, state };
}

describe('useSession', () => {
  it('shares one auth subscription between consumers', async () => {
    const { services, state } = counted();
    const w = wrap(services);
    await renderHook(() => useSession(), { wrapper: w });
    await renderHook(() => useSession(), { wrapper: w });
    expect(state.calls).toBe(1);
    expect(state.open).toBe(1);
  });

  it('gives a late subscriber the cached state', async () => {
    const { services } = counted();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    const w = wrap(services);
    await renderHook(() => useSession(), { wrapper: w });
    const late = await renderHook(() => useSession(), { wrapper: w });
    expect(late.result.current.status).toBe('signedIn');
    expect(late.result.current.session?.userId).toBe('user-demo');
  });

  it('delivers sign-out then sign-in to every consumer', async () => {
    const { services } = counted();
    const w = wrap(services);
    const a = await renderHook(() => useSession(), { wrapper: w });
    const b = await renderHook(() => useSession(), { wrapper: w });
    expect(a.result.current.status).toBe('signedOut');
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    expect(a.result.current.status).toBe('signedIn');
    expect(b.result.current.status).toBe('signedIn');
    await act(async () => {
      await services.repos.auth.signOut();
    });
    expect(a.result.current.status).toBe('signedOut');
    expect(b.result.current.status).toBe('signedOut');
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    expect(a.result.current.status).toBe('signedIn');
    expect(b.result.current.status).toBe('signedIn');
  });

  it('closes when the last consumer unmounts and resubscribes fresh without a stale last', async () => {
    const { services, state } = counted();
    const w = wrap(services);
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    const a = await renderHook(() => useSession(), { wrapper: w });
    const b = await renderHook(() => useSession(), { wrapper: w });
    await a.unmount();
    expect(state.open).toBe(1);
    await b.unmount();
    expect(state.open).toBe(0);

    await act(async () => {
      await services.repos.auth.signOut();
    });
    const c = await renderHook(() => useSession(), { wrapper: w });
    expect(state.calls).toBe(2);
    expect(state.open).toBe(1);
    expect(c.result.current.status).toBe('signedOut');
  });
});
