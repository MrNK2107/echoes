import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { analyzeSentiment } from '@/domain/sentiment';
import type { Memory } from '@/domain/types';
import { BlocksProvider } from '@/features/safety/BlocksProvider';
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
      <BlocksProvider>
        <EditMemoryScreen memoryId={id} />
      </BlocksProvider>
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

  it('marks the title as a header', async () => {
    await setup();
    expect(await screen.findByRole('header', { name: 'Edit memory' })).toBeOnTheScreen();
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
        { textContent: m.textContent, privacy: 'timeRelease', taggedUserIds: [], releaseDate: FUTURE, communityId: null, sentiment: m.sentiment },
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

  function prepareWith(over: Partial<Memory>) {
    return (s: Services) => {
      return s.repos.memories.update(
        'memory-2',
        {
          textContent: OWN_TEXT,
          privacy: 'public',
          taggedUserIds: [],
          releaseDate: null,
          communityId: null,
          sentiment: analyzeSentiment(OWN_TEXT),
          ...over,
        },
        s.now(),
      );
    };
  }

  it('recomputes sentiment from the edited text', async () => {
    const services = await setup();
    const text = 'I hate this terrible, awful place. So sad.';
    await fireEvent.changeText(await screen.findByTestId('text-input'), text);
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const m = await services.repos.memories.findById('memory-2');
    expect(m?.sentiment).toEqual(analyzeSentiment(text));
    expect(m?.sentiment.compound).toBeLessThan(0);
  });

  it('saves a text-only edit of an already released time-release memory', async () => {
    const past = new Date('2020-01-01T00:00:00Z');
    const services = await setup('memory-2', prepareWith({ privacy: 'timeRelease', releaseDate: past }));
    await fireEvent.changeText(await screen.findByTestId('text-input'), 'Still mine');
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const m = await services.repos.memories.findById('memory-2');
    expect(m).toMatchObject({ textContent: 'Still mine', privacy: 'timeRelease' });
    expect(m?.releaseDate).toEqual(past);
  });

  it('a text-only edit preserves tagged users', async () => {
    const services = await setup('memory-2', prepareWith({ privacy: 'tagged', taggedUserIds: ['user-asha'] }));
    await fireEvent.changeText(await screen.findByTestId('text-input'), 'Tagged edit');
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await services.repos.memories.findById('memory-2')).toMatchObject({
      textContent: 'Tagged edit',
      privacy: 'tagged',
      taggedUserIds: ['user-asha'],
    });
  });

  it('a text-only edit preserves the community', async () => {
    const services = await setup('memory-2', prepareWith({ privacy: 'community', communityId: 'c-1' }));
    await fireEvent.changeText(await screen.findByTestId('text-input'), 'Community edit');
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await services.repos.memories.findById('memory-2')).toMatchObject({
      privacy: 'community',
      communityId: 'c-1',
    });
  });

  it('shows tagged people as chips and saves an added tag', async () => {
    const services = await setup('memory-2', prepareWith({ privacy: 'tagged', taggedUserIds: ['user-asha'] }));
    expect(await screen.findByTestId('chip-user-asha')).toHaveTextContent(/Asha Rao/);
    await fireEvent.changeText(screen.getByLabelText('Search people'), 'Ro');
    await fireEvent.press(await screen.findByText('Rohan Mehta'));
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await services.repos.memories.findById('memory-2')).toMatchObject({
      privacy: 'tagged',
      taggedUserIds: ['user-asha', 'user-rohan'],
    });
  });

  it('removing the last tag is refused with the tagged copy', async () => {
    await setup('memory-2', prepareWith({ privacy: 'tagged', taggedUserIds: ['user-asha'] }));
    await fireEvent.press(await screen.findByLabelText('Remove Asha Rao'));
    await fireEvent.press(screen.getByText('Save changes'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one tagged user.');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('switches a public memory to a community', async () => {
    const services = await setup();
    await fireEvent.press(await screen.findByText('Community'));
    await fireEvent.press(await screen.findByText('Cubbon Park Walkers'));
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await services.repos.memories.findById('memory-2')).toMatchObject({
      privacy: 'community',
      communityId: 'community-cubbon-walkers',
      taggedUserIds: [],
    });
  });

  it('a new save waits for a timed-out update so a late write cannot clobber it', async () => {
    const services = await setup();
    const real = services.repos.memories.update.bind(services.repos.memories);
    const gates: (() => void)[] = [];
    const order: string[] = [];
    jest.spyOn(services.repos.memories, 'update').mockImplementation(async (id, patch, at) => {
      order.push(patch.textContent);
      if (gates.length === 0 && order.length === 1) await new Promise<void>((r) => gates.push(r));
      await real(id, patch, at);
    });
    await fireEvent.changeText(await screen.findByTestId('text-input'), 'first');
    jest.useFakeTimers();
    try {
      await act(async () => {
        void fireEvent.press(screen.getByText('Save changes'));
        await jest.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
      });
      expect(screen.getByRole('alert')).toHaveTextContent(/Could not reach the server/);
      await act(async () => {
        void fireEvent.changeText(screen.getByTestId('text-input'), 'second');
      });
      await act(async () => {
        void fireEvent.press(screen.getByText('Save changes'));
        await jest.advanceTimersByTimeAsync(1000);
      });
      expect(order).toEqual(['first']); // second is held back behind the in-flight first
      await act(async () => {
        gates[0]!();
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(order).toEqual(['first', 'second']);
      expect(mockBack).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
    expect((await services.repos.memories.findById('memory-2'))?.textContent).toBe('second');
  });

  it('goes back without rendering for a non-author', async () => {
    await setup('memory-1');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(screen.queryByText('Edit memory')).toBeNull();
    expect(screen.queryByTestId('text-input')).toBeNull();
  });
});

describe('EditMemoryScreen profanity check', () => {
  const WARNING = 'This memory may contain offensive language. Save anyway?';
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  function answer(label: string) {
    return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === label)?.onPress?.();
    });
  }

  it('Edit keeps the form and saves nothing', async () => {
    const alert = answer('Edit');
    const services = await setup();
    const update = jest.spyOn(services.repos.memories, 'update');
    await fireEvent.changeText(await screen.findByTestId('text-input'), 'Such a bullshit Sunday');
    await fireEvent.press(screen.getByText('Save changes'));
    expect(alert).toHaveBeenCalledWith(WARNING, undefined, [
      expect.objectContaining({ text: 'Edit', style: 'cancel' }),
      expect.objectContaining({ text: 'Save anyway' }),
    ]);
    expect(update).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByTestId('text-input').props.value).toBe('Such a bullshit Sunday');
  });

  it('Save anyway saves the edit', async () => {
    answer('Save anyway');
    const services = await setup();
    await fireEvent.changeText(await screen.findByTestId('text-input'), 'Such a bullshit Sunday');
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect((await services.repos.memories.findById('memory-2'))?.textContent).toBe('Such a bullshit Sunday');
  });

  it('does not ask when the text did not change', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await setup('memory-2', async (s) => {
      const m = (await s.repos.memories.findById('memory-2'))!;
      await s.repos.memories.update(
        'memory-2',
        { ...m, textContent: 'Such a bullshit Sunday' },
        s.now(),
      );
    });
    await screen.findByDisplayValue('Such a bullshit Sunday');
    await fireEvent.press(screen.getByTestId('privacy-private'));
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(alert).not.toHaveBeenCalled();
  });
});
