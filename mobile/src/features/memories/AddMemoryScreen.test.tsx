import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DEMO_USER } from '@/data/seed';
import { fakeImagePicker, fakeLocation, testServices } from '@/device/fakes';
import type { Memory } from '@/domain/types';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { AddMemoryScreen } from './AddMemoryScreen';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: mockBack }) }));
jest.mock('./compressImage', () => ({ compressImage: async (u: string) => u }));
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({ onChange }: { onChange: (e: unknown, d?: Date) => void }) =>
      React.createElement(Pressable, {
        testID: 'mock-date-picker',
        onPress: () => onChange({ type: 'set' }, new Date('2027-01-01T00:00:00Z')),
      }),
  };
});

async function setup(overrides: Partial<Services> = {}) {
  const services = testServices(overrides);
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
  await render(
    <ServicesProvider services={services}>
      <AddMemoryScreen />
    </ServicesProvider>,
  );
  return services;
}

describe('AddMemoryScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a character counter', async () => {
    await setup();
    await fireEvent.changeText(screen.getByTestId('text-input'), 'hello');
    expect(screen.getByText('5/2000')).toBeOnTheScreen();
  });

  it('saves a memory and navigates to the place', async () => {
    const services = await setup();
    await fireEvent.changeText(screen.getByTestId('text-input'), 'A wonderful sunny day');
    await fireEvent.press(screen.getByText('Public'));
    await fireEvent.press(screen.getByTestId('use-location-button'));
    expect(await screen.findByText('Location captured')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('save-button'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    const path = mockReplace.mock.calls[0]![0] as string;
    expect(path).toMatch(/^\/place\//);
    const placeId = path.replace('/place/', '');
    let memories: Memory[] = [];
    const off = services.repos.memories.subscribeVisibleForPlace(
      { placeId, viewerId: 'user-demo', viewerCommunityIds: [], now: services.now() },
      (m) => {
        memories = m;
      },
    );
    await Promise.resolve();
    off();
    expect(memories.some((m) => m.textContent === 'A wonderful sunny day')).toBe(true);
  });

  it('ignores a cancelled pick', async () => {
    await setup({ imagePicker: fakeImagePicker(null) });
    await fireEvent.press(screen.getByTestId('add-photo-button'));
    await act(async () => {});
    expect(screen.queryByTestId('photo-thumbnail')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows and removes a picked photo', async () => {
    await setup({ imagePicker: fakeImagePicker({ uri: 'file:///p.jpg', width: 10, height: 10, fileSize: 1 }) });
    await fireEvent.press(screen.getByTestId('add-photo-button'));
    expect(await screen.findByTestId('photo-thumbnail')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Remove photo'));
    expect(screen.queryByTestId('photo-thumbnail')).toBeNull();
  });

  it('explains denied location permission', async () => {
    await setup({ location: fakeLocation({ permission: 'denied' }) });
    await fireEvent.press(screen.getByTestId('use-location-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Location permission is needed to save a memory here.',
    );
  });

  it('requires a future release date for time release', async () => {
    await setup();
    await fireEvent.changeText(screen.getByTestId('text-input'), 'for later');
    await fireEvent.press(screen.getByText('Time release'));
    await fireEvent.press(screen.getByTestId('use-location-button'));
    await screen.findByText('Location captured');
    await fireEvent.press(screen.getByTestId('save-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a release date.');
    await fireEvent.press(screen.getByTestId('release-date-button'));
    await fireEvent.press(screen.getByTestId('mock-date-picker'));
    await fireEvent.press(screen.getByTestId('save-button'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  });
});
