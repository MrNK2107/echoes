import { renderHook, act } from '@testing-library/react-native';
import React from 'react';

import { fakeHeading, testServices } from '@/device/fakes';
import type { HeadingService } from '@/device/types';
import { ServicesProvider } from '@/services/ServicesProvider';

import { useHeading } from './useHeading';

function wrap(heading: HeadingService) {
  const services = testServices({ heading });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ServicesProvider services={services}>{children}</ServicesProvider>;
  };
}

function controllable() {
  let cb: (d: number) => void = () => {};
  const off = jest.fn();
  const service: HeadingService = {
    subscribe: async (c) => {
      cb = c;
      return off;
    },
  };
  return { service, emit: (d: number) => cb(d), off };
}

describe('useHeading', () => {
  it('heading wraps without jumping', async () => {
    const c = controllable();
    const { result } = await renderHook(() => useHeading(), { wrapper: wrap(c.service) });
    await act(async () => {});
    await act(async () => c.emit(358));
    expect(result.current.heading).toBeCloseTo(358);
    await act(async () => c.emit(10));
    // shortest arc: 358 -> 0.4 (through north), not swinging back through 180
    expect(result.current.heading).toBeCloseTo(0.4);
    expect(result.current.unavailable).toBe(false);
  });

  it('no compass keeps north up', async () => {
    const { result } = await renderHook(() => useHeading(), { wrapper: wrap(fakeHeading('unavailable')) });
    await act(async () => {});
    expect(result.current).toEqual({ heading: 0, unavailable: true });
  });

  it('drops non-finite readings', async () => {
    const c = controllable();
    const { result } = await renderHook(() => useHeading(), { wrapper: wrap(c.service) });
    await act(async () => {});
    await act(async () => c.emit(90));
    await act(async () => c.emit(NaN));
    await act(async () => c.emit(Infinity));
    expect(result.current.heading).toBeCloseTo(90);
  });

  it('unsubscribes on unmount, also when unmounted before subscribe resolves', async () => {
    const c = controllable();
    const first = await renderHook(() => useHeading(), { wrapper: wrap(c.service) });
    await act(async () => {});
    await first.unmount();
    expect(c.off).toHaveBeenCalledTimes(1);

    const late = controllable();
    const second = await renderHook(() => useHeading(), { wrapper: wrap(late.service) });
    await second.unmount();
    await act(async () => {});
    expect(late.off).toHaveBeenCalledTimes(1);
  });

  it('skips updates that move less than 1 degree, measured on the shortest arc', async () => {
    const c = controllable();
    let renders = 0;
    const { result } = await renderHook(
      () => {
        renders++;
        return useHeading();
      },
      { wrapper: wrap(c.service) },
    );
    await act(async () => {});
    await act(async () => c.emit(359.5));
    const after = renders;
    // smoothed 359.5 -> 359.6, then 359.7: across north the raw jump is 359 but the arc is under 1 degree
    await act(async () => c.emit(0));
    await act(async () => c.emit(0));
    expect(renders).toBe(after);
    expect(result.current.heading).toBeCloseTo(359.5);
    await act(async () => c.emit(30));
    expect(renders).toBeGreaterThan(after);
  });

  it('treats a null subscription as unavailable', async () => {
    const service = { subscribe: async () => null } as unknown as HeadingService;
    const { result } = await renderHook(() => useHeading(), { wrapper: wrap(service) });
    await act(async () => {});
    expect(result.current).toEqual({ heading: 0, unavailable: true });
  });
});
