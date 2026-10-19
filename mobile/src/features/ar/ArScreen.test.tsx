import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';

import { DEMO_CENTER as SEED_CENTER, DEMO_USER } from '@/data/seed';
import { mapArScene } from '@/domain/arScene';
import { fakeHeading, testServices } from '@/device/fakes';
import type { ArRenderer, ArSceneProps } from '@/device/types';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';
import {
  AR_CAMERA_DENIED,
  AR_CAMERA_VIEW,
  AR_EMPTY,
  AR_HEADING_UNAVAILABLE,
  AR_LOADING,
  AR_RADAR_VIEW,
  AR_UNSUPPORTED,
} from '@/ui/copy';

import { ArScreen } from './ArScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));

const sceneSpy = jest.fn<void, [ArSceneProps]>();
const lastScene = () => sceneSpy.mock.lastCall![0];
function FakeScene(props: ArSceneProps) {
  sceneSpy(props);
  return <Text>camera scene</Text>;
}

function availableRenderer(camera: 'granted' | 'denied' = 'granted'): ArRenderer & { requestCamera: jest.Mock } {
  return { status: async () => 'available', requestCamera: jest.fn(async () => camera), Scene: FakeScene };
}

async function setup(overrides: Partial<Services> = {}) {
  const services = testServices({ heading: fakeHeading([0]), ...overrides });
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
  await render(
    <ServicesProvider services={services}>
      <ArScreen />
    </ServicesProvider>,
  );
  return services;
}

async function setupWith(services: Services) {
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
  await render(
    <ServicesProvider services={services}>
      <ArScreen />
    </ServicesProvider>,
  );
}

describe('ArScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    sceneSpy.mockClear();
  });

  it('falls back to radar when AR module is missing', async () => {
    await setup();
    expect(await screen.findByText(AR_UNSUPPORTED)).toBeOnTheScreen();
    expect(await screen.findByTestId('radar-place-place-4')).toBeOnTheScreen();
    expect(screen.queryByText(AR_RADAR_VIEW)).toBeNull();
    expect(screen.queryByText(AR_CAMERA_VIEW)).toBeNull();
  });

  it('shows the unsupported copy and never asks for the camera when the device is unsupported', async () => {
    const renderer = { ...availableRenderer(), status: async () => 'unsupported' as const };
    await setup({ arRenderer: renderer });
    expect(await screen.findByText(AR_UNSUPPORTED)).toBeOnTheScreen();
    expect(renderer.requestCamera).not.toHaveBeenCalled();
  });

  it('shows the camera copy and the radar when camera access is denied', async () => {
    const renderer = availableRenderer('denied');
    await setup({ arRenderer: renderer });
    expect(await screen.findByText(AR_CAMERA_DENIED)).toBeOnTheScreen();
    expect(await screen.findByTestId('radar-place-place-4')).toBeOnTheScreen();
    expect(screen.queryByText('camera scene')).toBeNull();
    expect(screen.queryByText(AR_CAMERA_VIEW)).toBeNull();
  });

  it('renders the camera scene with a toggle when AR is available and granted', async () => {
    await setup({ arRenderer: availableRenderer() });
    expect(await screen.findByText('camera scene')).toBeOnTheScreen();
    // Seed dependency: from the demo centre, 5 seeded places lie within 1 km (Vidhana Soudha is the
    // 5th at about 989 m; MG Road Metro and Freedom Park are beyond 1 km), and 5 is also the cap.
    await waitFor(() => expect(sceneSpy.mock.lastCall?.[0].places.length).toBe(5));
    expect(lastScene().places[0]).toMatchObject({ placeId: 'place-4', name: 'UB City' });
    await act(async () => {
      fireEvent.press(screen.getByText(AR_RADAR_VIEW));
    });
    expect(await screen.findByTestId('radar-place-place-4')).toBeOnTheScreen();
    expect(screen.queryByText('camera scene')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByText(AR_CAMERA_VIEW));
    });
    expect(await screen.findByText('camera scene')).toBeOnTheScreen();
  });

  it("never makes an orb of the author's own hidden (moderated) memory", async () => {
    const services = testServices({ heading: fakeHeading([0]), arRenderer: availableRenderer() });
    const original = services.repos.memories.subscribeVisibleForPlace.bind(services.repos.memories);
    let hiddenId: string | null = null;
    jest.spyOn(services.repos.memories, 'subscribeVisibleForPlace').mockImplementation((q, cb, err) =>
      original(
        q,
        (memories) => {
          if (q.placeId === 'place-4' && memories.length > 0) {
            hiddenId = memories[0].id;
            cb(memories.map((m, i) => (i === 0 ? { ...m, moderation: 'hidden' as const } : m)));
          } else cb(memories);
        },
        err,
      ),
    );
    await setupWith(services);
    await waitFor(() => expect(hiddenId).not.toBeNull());
    await waitFor(() => expect(sceneSpy.mock.lastCall?.[0].places.length).toBe(5));
    const place4 = lastScene().places.find((p) => p.placeId === 'place-4')!;
    expect(place4.memoryIds).not.toContain(hiddenId);
  });

  it('mounts the camera scene only after a real compass sample and latches that heading', async () => {
    let emit: (d: number) => void = () => {};
    await setup({
      arRenderer: availableRenderer(),
      heading: {
        subscribe: async (cb) => {
          emit = cb;
          return () => {};
        },
      },
    });
    await screen.findByTestId('radar-place-place-4').catch(() => null);
    await waitFor(() => expect(screen.queryByLabelText(AR_LOADING)).toBeOnTheScreen());
    expect(sceneSpy).not.toHaveBeenCalled();
    await act(async () => emit(123));
    expect(await screen.findByText('camera scene')).toBeOnTheScreen();
    expect(sceneSpy.mock.calls[0][0].heading).toBeCloseTo(123);
  });

  it('shows the radar with the compass copy and no camera toggle when there is no compass', async () => {
    await setup({ arRenderer: availableRenderer(), heading: fakeHeading('unavailable') });
    expect(await screen.findByText(AR_HEADING_UNAVAILABLE)).toBeOnTheScreen();
    expect(await screen.findByTestId('radar-place-place-4')).toBeOnTheScreen();
    expect(screen.queryByText('camera scene')).toBeNull();
    expect(screen.queryByText(AR_CAMERA_VIEW)).toBeNull();
    expect(screen.queryByText(AR_RADAR_VIEW)).toBeNull();
    expect(sceneSpy).not.toHaveBeenCalled();
  });

  it('falls back to the radar with the compass copy when the compass never reports', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      await setup({
        arRenderer: availableRenderer(),
        heading: { subscribe: async () => () => {} },
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(4500);
      });
      expect(await screen.findByText(AR_HEADING_UNAVAILABLE)).toBeOnTheScreen();
      expect(await screen.findByTestId('radar-place-place-4')).toBeOnTheScreen();
      expect(screen.queryByText(AR_CAMERA_VIEW)).toBeNull();
      expect(sceneSpy).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('drops the camera scene for the radar when the compass fails after it was ready', async () => {
    let emit: (d: number) => void = () => {};
    let fail: (e: Error) => void = () => {};
    await setup({
      arRenderer: availableRenderer(),
      heading: {
        subscribe: (cb) => {
          emit = cb;
          return new Promise((_, reject) => {
            fail = reject;
          });
        },
      },
    });
    await act(async () => emit(10));
    expect(await screen.findByText('camera scene')).toBeOnTheScreen();
    await act(async () => fail(new Error('compass lost')));
    expect(await screen.findByText(AR_HEADING_UNAVAILABLE)).toBeOnTheScreen();
    expect(screen.queryByText('camera scene')).toBeNull();
    expect(await screen.findByTestId('radar-place-place-4')).toBeOnTheScreen();
  });

  it('falls back to the radar when the scene reports a tracking error', async () => {
    await setup({ arRenderer: availableRenderer() });
    await screen.findByText('camera scene');
    await act(async () => lastScene().onTrackingError());
    expect(await screen.findByTestId('radar-place-place-4')).toBeOnTheScreen();
  });

  it('shows the empty state when no place is within 1 km', async () => {
    const base = testServices();
    await setup({ location: { ...base.location, getCurrentPosition: async () => ({ latitude: 20, longitude: 70 }) } });
    expect(await screen.findByText(AR_EMPTY)).toBeOnTheScreen();
    expect(screen.queryByTestId(/^radar-place-/)).toBeNull();
  });

  it('shows the compass copy and keeps north up when the heading is unavailable', async () => {
    await setup({ heading: fakeHeading('unavailable') });
    expect(await screen.findByText(AR_HEADING_UNAVAILABLE)).toBeOnTheScreen();
    expect(await screen.findByTestId('radar-place-place-4')).toBeOnTheScreen();
  });

  it('labels places with name and distance and orbs with the memory text', async () => {
    await setup();
    expect(await screen.findByLabelText('UB City, 187 m')).toBeOnTheScreen();
    expect(screen.getByLabelText('Cubbon Park, 554 m')).toBeOnTheScreen();
    expect(
      await screen.findByLabelText(`Memory: ${'Walked past the mall on the way to the office.'.slice(0, 40)}`),
    ).toBeOnTheScreen();
    expect(screen.getByText('250 m')).toBeOnTheScreen();
    expect(screen.getByText('1 km')).toBeOnTheScreen();
  });

  it('puts the place at the top of the radar when the heading equals its bearing', async () => {
    const services = testServices();
    const place = (await services.repos.places.findById('place-4'))!;
    const bearing = mapArScene(SEED_CENTER, [place])[0]!.bearingDegrees;
    let emit: (d: number) => void = () => {};
    await setup({
      heading: {
        subscribe: async (cb) => {
          emit = cb;
          cb(0);
          return () => {};
        },
      },
    });
    await screen.findByTestId('radar-place-place-4');
    const centre = () => {
      const st = StyleSheet.flatten(screen.getByTestId('radar-place-place-4').props.style);
      const size = StyleSheet.flatten(screen.getByTestId('radar').props.style).width as number;
      return { x: (st.left as number) + 22, y: (st.top as number) + 22, c: size / 2 };
    };
    const before = centre();
    expect(before.x).toBeGreaterThan(before.c + 20);
    await act(async () => {
      for (let i = 0; i < 80; i++) emit(bearing);
    });
    await waitFor(() => expect(Math.abs(centre().x - before.c)).toBeLessThan(2));
    expect(centre().y).toBeLessThan(before.c);
  });

  it('hides orbs until the block list is ready (memories already loaded), then shows them', async () => {
    const services = testServices({ heading: fakeHeading([0]) });
    let emit!: (ids: string[]) => void;
    jest.spyOn(services.repos.safety, 'subscribeBlocks').mockImplementation((_uid, cb) => {
      emit = cb;
      return () => {};
    });
    let delivered = 0;
    const original = services.repos.memories.subscribeVisibleForPlace.bind(services.repos.memories);
    jest.spyOn(services.repos.memories, 'subscribeVisibleForPlace').mockImplementation((q, cb, err) =>
      original(
        q,
        (m) => {
          delivered++;
          cb(m);
        },
        err,
      ),
    );
    await setupWith(services);
    // Memories for all 5 places have arrived, so only the block gate is hiding the orbs.
    await waitFor(() => expect(delivered).toBeGreaterThanOrEqual(5));
    expect(screen.queryByTestId(/^radar-orb-/)).toBeNull();
    // Positive control: with an empty block list the same data shows the orbs.
    await act(async () => emit([]));
    expect(await screen.findByTestId('radar-orb-memory-1')).toBeOnTheScreen();
    expect(screen.getByTestId('radar-orb-memory-2')).toBeOnTheScreen();
  });

  it('hides blocked authors orbs once the block list is ready', async () => {
    const services = testServices({ heading: fakeHeading([0]) });
    await services.repos.safety.block('user-demo', 'user-asha', services.now());
    await setupWith(services);
    expect(await screen.findByTestId('radar-orb-memory-2')).toBeOnTheScreen();
    expect(screen.getByTestId('radar-orb-memory-3')).toBeOnTheScreen();
    expect(screen.queryByTestId('radar-orb-memory-1')).toBeNull();
  });

  it('renders place targets after all orbs so an aura tap is never swallowed by an orb', async () => {
    await setup();
    await screen.findByTestId('radar-orb-memory-11');
    const order = screen.getAllByTestId(/^radar-(place|orb)-/).map((n) => n.props.testID as string);
    const lastOrb = Math.max(...order.map((id, i) => (id.startsWith('radar-orb-') ? i : -1)));
    const firstPlace = order.findIndex((id) => id.startsWith('radar-place-'));
    expect(firstPlace).toBeGreaterThan(lastOrb);
  });

  it('shows the camera-denied copy when requesting the camera throws', async () => {
    const renderer = { ...availableRenderer(), requestCamera: jest.fn(async () => Promise.reject(new Error('boom'))) };
    await setup({ arRenderer: renderer });
    expect(await screen.findByText(AR_CAMERA_DENIED)).toBeOnTheScreen();
    expect(screen.queryByText(AR_UNSUPPORTED)).toBeNull();
  });

  it('announces the mode notice politely', async () => {
    await setup();
    const notice = await screen.findByText(AR_UNSUPPORTED);
    expect(notice.props.accessibilityLiveRegion).toBe('polite');
    expect(notice.props.accessibilityRole).toBe('alert');
  });

  it('announces the mode notice for screen readers that ignore live regions', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await setup();
    await screen.findByText(AR_UNSUPPORTED);
    expect(announce).toHaveBeenCalledWith(AR_UNSUPPORTED);
    announce.mockRestore();
  });

  it('draws place names as decorative labels that screen readers skip', async () => {
    await setup();
    const label = await screen.findByText('UB City');
    expect(label.props.accessible).toBe(false);
    expect(label.props.importantForAccessibility).toBe('no');
    expect(screen.getByText('Sree Kanteerava…')).toBeOnTheScreen();
  });

  it('navigates to the place and memory on tap', async () => {
    await setup();
    const place = await screen.findByLabelText('UB City, 187 m');
    await act(async () => {
      fireEvent.press(place);
    });
    expect(mockPush).toHaveBeenCalledWith('/place/place-4');
    const orb = await screen.findByTestId('radar-orb-memory-11');
    await act(async () => {
      fireEvent.press(orb);
    });
    expect(mockPush).toHaveBeenCalledWith('/memory/memory-11');
  });
});
