import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { EditMemoryScreen } from './EditMemoryScreen';
import { SUBMIT_TIMEOUT_MS } from './submitMemory';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({ onChange }: { onChange: (e: unknown, d?: Date) => void }) =>
      React.createElement(Pressable, {
        testID: 'mock-date-picker',
        onPress: () => onChange({ type: 'set' }, new Date('2020-01-01T00:00:00Z')),
      }),
  };
});

const FUTURE = new Date('2099-01-01T00:00:00Z');
const OWN_TEXT = 'What a wonderful, beautiful Sunday under these old trees. Pure joy.';

async function setup(id = 'memory-2', prepare?: (s: Services) => Promise<void>) {
  const services = testServices();
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    await prepare?.(services);
  });
  await render(
    <ServicesProvider services={services}>
      <EditMemoryScreen memoryId={id} />
    </ServicesProvider>,
  );
  return services;
}

describe('EditMemoryScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('prefills text and privacy', async () => {
    await setup();
    expect(await screen.findByDisplayValue(OWN_TEXT)).toBeOnTheScreen();
    expect(screen.getByText('Edit memory')).toBeOnTheScreen();
    expect(screen.getByText('Save changes')).toBeOnTheScreen();
    expect(screen.getByTestId('privacy-public')).toBeSelected();
  });

  it('saves updated text and goes back', async () => {
    const services = await setup();
    await fireEvent.changeText(await screen.findByTestId('text-input'), '  Edited words  ');
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const m = await services.repos.memories.findById('memory-2');
    expect(m?.textContent).toBe('Edited words');
    expect(m?.privacy).toBe('public');
  });

  it('switching to public clears release date', async () => {
    const services = await setup('memory-2', async (s) => {
      const m = (await s.repos.memories.findById('memory-2'))!;
      await s.repos.memories.update(
        m.id,
        { textContent: m.textContent, privacy: 'timeRelease', taggedUserIds: [], releaseDate: FUTURE, communityId: null },
        s.now(),
      );
    });
    await screen.findByTestId('text-input');
    expect(screen.getByTestId('privacy-timeRelease')).toBeSelected();
    await fireEvent.press(screen.getByTestId('privacy-public'));
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const m = await services.repos.memories.findById('memory-2');
    expect(m?.privacy).toBe('public');
    expect(m?.releaseDate).toBeNull();
  });

  it('rejects a past release date', async () => {
    const services = await setup();
    await fireEvent.press(await screen.findByTestId('privacy-timeRelease'));
    await fireEvent.press(screen.getByTestId('release-date-button'));
    await fireEvent.press(screen.getByTestId('mock-date-picker'));
    await fireEvent.press(screen.getByText('Save changes'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a future release date.');
    expect(mockBack).not.toHaveBeenCalled();
    expect((await services.repos.memories.findById('memory-2'))?.privacy).toBe('public');
  });

  it('rejects empty text', async () => {
    await setup();
    await fireEvent.changeText(await screen.findByTestId('text-input'), '   ');
    await fireEvent.press(screen.getByText('Save changes'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Write something to remember.');
  });

  it('shows timeout copy when the server does not answer', async () => {
    const services = await setup();
    jest.spyOn(services.repos.memories, 'update').mockImplementation(() => new Promise(() => {}));
    await screen.findByTestId('text-input');
    jest.useFakeTimers();
    try {
      await act(async () => {
        void fireEvent.press(screen.getByText('Save changes'));
        await jest.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
      });
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not reach the server. Check your connection and try again.',
      );
      expect(mockBack).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('goes back without rendering for a non-author', async () => {
    await setup('memory-1');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(screen.queryByText('Edit memory')).toBeNull();
    expect(screen.queryByTestId('text-input')).toBeNull();
  });
});
