import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { fakeLocation, testServices } from '@/device/fakes';
import { distanceMeters } from '@/domain/geo';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { NEARBY_RADIUS_METERS, useNearbyPlaces } from './useNearbyPlaces';

const wrap = (services: Services) =>
  function Wrapper({ children }: { children: ReactNode }) {
    // eslint-disable-next-line react/no-children-prop
    return createElement(ServicesProvider, { services, children });
  };

describe('useNearbyPlaces', () => {
  it('exports the radius', () => {
    expect(NEARBY_RADIUS_METERS).toBe(1500);
  });

  it('is denied when permission is denied', async () => {
    const services = testServices({ location: fakeLocation({ permission: 'denied' }) });
    const { result } = await renderHook(() => useNearbyPlaces(), { wrapper: wrap(services) });
    await waitFor(() => expect(result.current.status).toBe('denied'));
  });

  it('shows error when position lookup throws', async () => {
    const services = testServices({ location: fakeLocation({ error: new Error('boom') }) });
    const { result } = await renderHook(() => useNearbyPlaces(), { wrapper: wrap(services) });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('retry re-requests permission', async () => {
    const location = fakeLocation({ permission: 'denied' });
    const spy = jest.spyOn(location, 'requestPermission');
    const services = testServices({ location });
    const { result } = await renderHook(() => useNearbyPlaces(), { wrapper: wrap(services) });
    await waitFor(() => expect(result.current.status).toBe('denied'));
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe('denied'));
  });

  it('is ready with seeded places sorted by distance', async () => {
    const services = testServices();
    const { result } = await renderHook(() => useNearbyPlaces(), { wrapper: wrap(services) });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const { center, places } = result.current;
    expect(center).not.toBeNull();
    expect(places.length).toBe(7);
    const d = places.map((p) => distanceMeters(center!, p));
    expect(d).toEqual([...d].sort((a, b) => a - b));
  });

  it('reports repository errors', async () => {
    const services = testServices();
    jest.spyOn(services.repos.places, 'subscribeNearby').mockImplementation((_q, _cb, onError) => {
      onError?.(new Error('x'));
      return () => {};
    });
    const { result } = await renderHook(() => useNearbyPlaces(), { wrapper: wrap(services) });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

describe('useNearbyPlaces once', () => {
  type Cb = (places: unknown[]) => void;
  function spied() {
    const services = testServices();
    const real = services.repos.places.subscribeNearby;
    const state: { cb: Cb | null; open: number } = { cb: null, open: 0 };
    jest.spyOn(services.repos.places, 'subscribeNearby').mockImplementation((q, cb, e) => {
      state.open += 1;
      state.cb = cb as Cb;
      const off = real(q, () => {}, e);
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
  const place = (id: string) => ({ id, name: id, latitude: 12.97, longitude: 77.59, memoryCount: 1, aura: { colorHex: '#fff' } });

  it('takes one snapshot, unsubscribes and ignores later emissions', async () => {
    const { services, state } = spied();
    const { result } = await renderHook(() => useNearbyPlaces({ once: true }), { wrapper: wrap(services) });
    await waitFor(() => expect(state.cb).not.toBeNull());
    await act(async () => state.cb!([place('a')]));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(state.open).toBe(0));
    await act(async () => state.cb!([place('a'), place('b')]));
    expect(result.current.places.map((p) => p.id)).toEqual(['a']);
  });

  it('ignores an empty first snapshot and stays subscribed until a non-empty one arrives', async () => {
    const { services, state } = spied();
    const { result } = await renderHook(() => useNearbyPlaces({ once: true }), { wrapper: wrap(services) });
    await waitFor(() => expect(state.cb).not.toBeNull());
    await act(async () => state.cb!([]));
    // Deviation from "status unchanged": AR's empty state needs 'ready' with no places.
    expect(result.current.status).toBe('ready');
    expect(result.current.places).toEqual([]);
    expect(state.open).toBe(1);
    await act(async () => state.cb!([place('a')]));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(state.open).toBe(0));
  });
});
