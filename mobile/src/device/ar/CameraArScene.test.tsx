import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import type { ArSceneProps } from '../types';
import { createCameraArScene, MOTION_TIMEOUT_MS, type CameraArDeps, type MotionRotation } from './CameraArScene';

const HALF_PI = Math.PI / 2;
/** Android W3C angles for an upright phone whose camera faces `heading` degrees. */
const facing = (heading: number): MotionRotation => ({ alpha: (-heading * Math.PI) / 180, beta: HALF_PI, gamma: 0 });

function place(id: string, bearingDegrees: number, orbs: string[] = []): ArSceneProps['places'][number] {
  return {
    placeId: id,
    name: `Place ${id}`,
    color: '#58a6ff',
    eastMeters: 0,
    northMeters: 0,
    distanceMeters: 300,
    bearingDegrees,
    sceneX: 0,
    sceneZ: 0,
    auraRadius: 3,
    auraOpacity: 0.3,
    visibleOrbCount: orbs.length,
    memoryIds: orbs,
    orbs: orbs.map((o) => ({ id: o, text: `text ${o}`, media: null })),
  };
}

function harness(declination = 0) {
  let emit: ((r: MotionRotation) => void) | null = null;
  let mountError: ((e: { message: string }) => void) | undefined;
  const unsubscribe = jest.fn();
  const deps: CameraArDeps = {
    CameraView: (props) => {
      mountError = props.onMountError;
      return <View testID="camera-preview" />;
    },
    platform: 'android',
    declination: async () => declination,
    subscribeMotion: (cb) => {
      emit = cb;
      return unsubscribe;
    },
  };
  const Scene = createCameraArScene(deps);
  const props = {
    onPressPlace: jest.fn(),
    onPressOrb: jest.fn(),
    onTrackingError: jest.fn(),
  };
  return {
    Scene,
    props,
    unsubscribe,
    emit: (r: MotionRotation) =>
      act(async () => {
        emit!(r);
      }),
    mountError: () =>
      act(async () => {
        mountError!({ message: 'camera busy' });
      }),
  };
}

async function layout() {
  await fireEvent(screen.getByTestId('camera-ar'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } });
}

describe('CameraArScene', () => {
  afterEach(() => jest.useRealTimers());

  it('shows the camera preview and no markers before the first attitude sample', async () => {
    const h = harness();
    await render(<h.Scene places={[place('a', 0)]} heading={0} {...h.props} />);
    await layout();
    expect(screen.getByTestId('camera-preview')).toBeOnTheScreen();
    expect(screen.queryByTestId('ar-place-a')).toBeNull();
  });

  it('places the aura and orbs in view and opens them on tap', async () => {
    const h = harness();
    await render(<h.Scene places={[place('a', 5, ['m1', 'm2'])]} heading={0} {...h.props} />);
    await layout();
    await h.emit(facing(0));
    expect(screen.getByLabelText('Place a, 300 m')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('ar-place-a'));
    expect(h.props.onPressPlace).toHaveBeenCalledWith('a');
    await fireEvent.press(screen.getByLabelText('Memory: text m2'));
    expect(h.props.onPressOrb).toHaveBeenCalledWith('m2');
  });

  it('moves out-of-view places to the screen edges and hints to turn', async () => {
    const h = harness();
    await render(<h.Scene places={[place('a', 5), place('b', 120)]} heading={0} {...h.props} />);
    await layout();
    await h.emit(facing(60));
    expect(screen.queryByTestId('ar-place-a')).toBeNull();
    expect(screen.getByLabelText('Place a, 300 m, to your left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Place b, 300 m, to your right')).toBeOnTheScreen();
    expect(screen.getByText('Turn slowly to find memories around you.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('ar-edge-b'));
    expect(h.props.onPressPlace).toHaveBeenCalledWith('b');
    // Turning towards b brings it on screen.
    for (let i = 0; i < 40; i++) await h.emit(facing(120));
    expect(screen.getByTestId('ar-place-b')).toBeOnTheScreen();
  });

  it('corrects magnetic sensor headings by the declination', async () => {
    const h = harness(40);
    await render(<h.Scene places={[place('a', 40)]} heading={0} {...h.props} />);
    await layout();
    await h.emit(facing(0));
    expect(screen.getByTestId('ar-place-a')).toBeOnTheScreen();
  });

  it('reports a tracking error once when no attitude arrives', async () => {
    jest.useFakeTimers();
    const h = harness();
    await render(<h.Scene places={[place('a', 0)]} heading={0} {...h.props} />);
    await act(async () => {
      jest.advanceTimersByTime(MOTION_TIMEOUT_MS + 10);
    });
    expect(h.props.onTrackingError).toHaveBeenCalledTimes(1);
    await h.mountError();
    expect(h.props.onTrackingError).toHaveBeenCalledTimes(1);
  });

  it('does not time out once attitude arrives, and reports camera mount errors', async () => {
    jest.useFakeTimers();
    const h = harness();
    await render(<h.Scene places={[place('a', 0)]} heading={0} {...h.props} />);
    await h.emit(facing(0));
    await act(async () => {
      jest.advanceTimersByTime(MOTION_TIMEOUT_MS * 2);
    });
    expect(h.props.onTrackingError).not.toHaveBeenCalled();
    await h.mountError();
    expect(h.props.onTrackingError).toHaveBeenCalledTimes(1);
  });

  it('stops the sensor on unmount', async () => {
    const h = harness();
    await render(<h.Scene places={[]} heading={0} {...h.props} />);
    await screen.unmount();
    expect(h.unsubscribe).toHaveBeenCalled();
  });
});
