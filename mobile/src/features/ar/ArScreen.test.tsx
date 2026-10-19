import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { fakeHeading, testServices } from '@/device/fakes';
import type { ArRenderer, ArSceneProps } from '@/device/types';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';
import {
  AR_CAMERA_DENIED,
  AR_CAMERA_VIEW,
  AR_EMPTY,
  AR_HEADING_UNAVAILABLE,
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

const left = (id: string) => StyleSheet.flatten(screen.getByTestId(`radar-place-${id}`).props.style).left as number;

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

  it('rotates marker positions with the heading', async () => {
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
    const atZero = left('place-4');
    await act(async () => {
      for (let i = 0; i < 40; i++) emit(90);
    });
    await waitFor(() => expect(Math.abs(left('place-4') - atZero)).toBeGreaterThan(20));
  });

  it('hides blocked authors orbs until the block list is ready', async () => {
    const services = testServices({ heading: fakeHeading([0]) });
    let emit!: (ids: string[]) => void;
    jest.spyOn(services.repos.safety, 'subscribeBlocks').mockImplementation((_uid, cb) => {
      emit = cb;
      return () => {};
    });
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    await render(
      <ServicesProvider services={services}>
        <ArScreen />
      </ServicesProvider>,
    );
    await screen.findByTestId('radar-place-place-1');
    expect(screen.queryByTestId(/^radar-orb-/)).toBeNull();
    await act(async () => emit(['user-asha']));
    expect(await screen.findByTestId('radar-orb-memory-2')).toBeOnTheScreen();
    expect(screen.getByTestId('radar-orb-memory-3')).toBeOnTheScreen();
    expect(screen.queryByTestId('radar-orb-memory-1')).toBeNull();
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
