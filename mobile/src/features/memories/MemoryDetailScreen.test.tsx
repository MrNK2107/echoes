import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { fakeAudioPlayer, testServices } from '@/device/fakes';
import type { Memory } from '@/domain/types';
import { MemoryCard } from '@/features/places/MemoryCard';
import { BlocksProvider } from '@/features/safety/BlocksProvider';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { MemoryDetailScreen } from './MemoryDetailScreen';
import { SUBMIT_TIMEOUT_MS } from './submitMemory';

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockFocus: (() => void) | undefined;
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useFocusEffect: (cb: () => void) => {
    mockFocus = cb;
  },
}));

async function setup(id: string, services: Services = testServices()) {
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
  await render(
    <ServicesProvider services={services}>
      <BlocksProvider>
        <MemoryDetailScreen memoryId={id} />
      </BlocksProvider>
    </ServicesProvider>,
  );
  return services;
}

function pressConfirm(label: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.();
  });
}

beforeEach(() => {
  mockBack.mockClear();
  mockPush.mockClear();
  jest.restoreAllMocks();
});

describe('MemoryDetailScreen', () => {
  it('shows Edit and Delete to the author with text', async () => {
    await setup('memory-2');
    expect(await screen.findByText('What a wonderful, beautiful Sunday under these old trees. Pure joy.')).toBeOnTheScreen();
    expect(screen.getByText('Edit')).toBeOnTheScreen();
    expect(screen.getByText('Delete')).toBeOnTheScreen();
  });

  it('plays the voice note when the memory has one', async () => {
    const services = testServices({ audioPlayer: fakeAudioPlayer() });
    await services.repos.memories.attachMedia('memory-2', { audioUrl: 'https://audio/2.m4a' }, services.now());
    await setup('memory-2', services);
    expect(await screen.findByLabelText('Play voice note')).toBeOnTheScreen();
  });

  it('shows no player without a voice note', async () => {
    await setup('memory-2');
    await screen.findByText('Edit');
    expect(screen.queryByLabelText('Play voice note')).toBeNull();
  });

  it('hides Edit and Delete from a stranger', async () => {
    await setup('memory-1');
    expect(await screen.findByText(/I love this park/)).toBeOnTheScreen();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it("shows the author's display name", async () => {
    await setup('memory-1');
    expect(await screen.findByText('Asha Rao')).toBeOnTheScreen();
  });

  it('treats a memory by someone you blocked as not available', async () => {
    const services = testServices();
    await services.repos.safety.block('user-demo', 'user-asha', services.now());
    await setup('memory-1', services);
    expect(await screen.findByText('This memory is no longer available.')).toBeOnTheScreen();
    expect(screen.queryByText(/I love this park/)).toBeNull();
  });

  it("does not show another author's memory until the block list has loaded", async () => {
    const services = testServices();
    let emit!: (ids: string[]) => void;
    jest.spyOn(services.repos.safety, 'subscribeBlocks').mockImplementation((_uid, cb) => {
      emit = cb;
      return () => {};
    });
    await setup('memory-1', services);
    await act(async () => {});
    expect(screen.queryByText(/I love this park/)).toBeNull();
    await act(async () => emit(['user-asha']));
    expect(screen.getByText('This memory is no longer available.')).toBeOnTheScreen();
    expect(screen.queryByText(/I love this park/)).toBeNull();
  });

  it('keeps the memory hidden with error copy when blocks fail before loading', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const services = testServices();
    let fail!: (e: Error) => void;
    jest.spyOn(services.repos.safety, 'subscribeBlocks').mockImplementation((_uid, _cb, onError) => {
      fail = onError!;
      return () => {};
    });
    await setup('memory-1', services);
    await act(async () => fail(new Error('denied')));
    expect(screen.queryByText(/I love this park/)).toBeNull();
    expect(screen.getByText("Couldn't load this memory.")).toBeOnTheScreen();
    warn.mockRestore();
  });

  it('Edit navigates to the edit route', async () => {
    await setup('memory-2');
    await fireEvent.press(await screen.findByText('Edit'));
    expect(mockPush).toHaveBeenCalledWith('/memory/memory-2/edit');
  });

  it('confirming Delete soft-deletes and goes back', async () => {
    const services = await setup('memory-2');
    const spy = pressConfirm('Delete');
    await fireEvent.press(await screen.findByText('Delete'));
    expect(spy).toHaveBeenCalledWith(
      'Delete this memory?',
      'You can restore it from Recently deleted for 30 days.',
      expect.arrayContaining([expect.objectContaining({ text: 'Cancel' }), expect.objectContaining({ text: 'Delete' })]),
    );
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect((await services.repos.memories.findById('memory-2'))?.isDeleted).toBe(true);
  });

  it('Cancel does nothing', async () => {
    const services = await setup('memory-2');
    pressConfirm('Cancel');
    await fireEvent.press(await screen.findByText('Delete'));
    expect(mockBack).not.toHaveBeenCalled();
    expect((await services.repos.memories.findById('memory-2'))?.isDeleted).toBe(false);
  });

  it('shows not-found copy for an unknown id', async () => {
    await setup('nope');
    expect(await screen.findByText('This memory is no longer available.')).toBeOnTheScreen();
  });

  it('shows not-found copy for a soft-deleted memory', async () => {
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
      await services.repos.memories.softDelete('memory-2', services.now());
    });
    await setup('memory-2', services);
    expect(await screen.findByText('This memory is no longer available.')).toBeOnTheScreen();
  });

  it('shows a Private badge', async () => {
    await setup('memory-7');
    expect(await screen.findByText('Private')).toBeOnTheScreen();
  });
});

describe('MemoryDetailScreen delete and focus', () => {
  it('ignores a repeated confirm: softDelete once, back once', async () => {
    const services = testServices();
    const softDelete = jest.spyOn(services.repos.memories, 'softDelete');
    await setup('memory-2', services);
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const del = buttons?.find((b) => b.text === 'Delete');
      del?.onPress?.();
      del?.onPress?.();
    });
    await fireEvent.press(await screen.findByText('Delete'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(softDelete).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows timeout copy and re-enables Delete when the server does not answer', async () => {
    const services = testServices();
    jest.spyOn(services.repos.memories, 'softDelete').mockImplementation(() => new Promise(() => {}));
    await setup('memory-2', services);
    pressConfirm('Delete');
    const del = await screen.findByText('Delete');
    jest.useFakeTimers();
    try {
      await fireEvent.press(del);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
      });
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not reach the server. Check your connection and try again.',
      );
      expect(mockBack).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows delete failure copy for other errors', async () => {
    const services = testServices();
    jest.spyOn(services.repos.memories, 'softDelete').mockRejectedValue(new Error('boom'));
    await setup('memory-2', services);
    pressConfirm('Delete');
    await fireEvent.press(await screen.findByText('Delete'));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't delete this memory. Try again.");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('refetches when the screen regains focus', async () => {
    const services = await setup('memory-2');
    expect(await screen.findByText(/Pure joy/)).toBeOnTheScreen();
    await act(async () => mockFocus?.()); // first focus: no extra fetch needed
    await act(async () => {
      await services.repos.memories.update(
        'memory-2',
        { textContent: 'Edited text', privacy: 'public', taggedUserIds: [], releaseDate: null, communityId: null, sentiment: { compound: 0, positive: 0, neutral: 1, negative: 0 } },
        services.now(),
      );
    });
    await act(async () => mockFocus?.());
    expect(await screen.findByText('Edited text')).toBeOnTheScreen();
  });
});

describe('MemoryDetailScreen safety', () => {
  const ASHA_TEXT = /I love this park/;

  it('offers Report and Block {name} to non-authors only', async () => {
    await setup('memory-1');
    expect(await screen.findByRole('button', { name: 'Block Asha Rao' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Report' })).toBeOnTheScreen();
  });

  it('offers neither Report nor Block to the author', async () => {
    await setup('memory-2');
    await screen.findByText('Edit');
    expect(screen.queryByRole('button', { name: 'Report' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Block/ })).toBeNull();
  });

  it('reports a memory and thanks the reporter', async () => {
    const services = testServices();
    const report = jest.spyOn(services.repos.safety, 'reportMemory');
    await setup('memory-1', services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Report' }));
    expect(screen.getByText('Why are you reporting this?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText("Thanks — we'll review it.")).toBeOnTheScreen();
    expect(report).toHaveBeenCalledWith({ memoryId: 'memory-1', reason: 'spam', note: null });
    expect(screen.queryByText('Why are you reporting this?')).toBeNull();
  });

  it('reports the author profile from Report {name} and shows the duplicate copy the second time', async () => {
    const services = testServices();
    const content = jest.spyOn(services.repos.safety, 'reportContent');
    await setup('memory-1', services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Report Asha Rao' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Hate speech' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText("Thanks — we'll review it.")).toBeOnTheScreen();
    expect(content).toHaveBeenCalledWith({ targetType: 'profile', targetId: 'user-asha', reason: 'hate', note: null });
    await fireEvent.press(screen.getByRole('button', { name: 'Report Asha Rao' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Hate speech' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('You already reported this.')).toBeOnTheScreen();
  });

  it('offers no Report {name} to the author', async () => {
    await setup('memory-2');
    await screen.findByText('Edit');
    expect(screen.queryByRole('button', { name: /^Report / })).toBeNull();
  });

  it('a second report shows the duplicate copy', async () => {
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
      await services.repos.safety.reportMemory({ memoryId: 'memory-1', reason: 'hate', note: null });
    });
    await setup('memory-1', services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Report' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('You already reported this.')).toBeOnTheScreen();
  });

  it('ignores another Block while one is in flight and disables the button', async () => {
    const services = testServices();
    let release!: () => void;
    const block = jest
      .spyOn(services.repos.safety, 'block')
      .mockImplementation(() => new Promise<void>((r) => (release = r)));
    const alert = pressConfirm('Block');
    await setup('memory-1', services);
    const button = await screen.findByRole('button', { name: 'Block Asha Rao' });
    await fireEvent.press(button);
    expect(screen.getByRole('button', { name: 'Block Asha Rao' })).toBeDisabled();
    // A second tap that still reaches the handler (same tick) is ignored as well.
    await act(async () => {
      (button.props.onClick as () => void)();
    });
    expect(block).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
    await act(async () => release());
    expect(screen.getByRole('button', { name: 'Block Asha Rao' })).toBeEnabled();
  });

  it('shows timeout copy and re-enables Block when the server does not answer', async () => {
    const services = testServices();
    jest.spyOn(services.repos.safety, 'block').mockImplementation(() => new Promise(() => {}));
    pressConfirm('Block');
    await setup('memory-1', services);
    const button = await screen.findByRole('button', { name: 'Block Asha Rao' });
    jest.useFakeTimers();
    try {
      await fireEvent.press(button);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server. Check your connection and try again.');
      expect(screen.getByRole('button', { name: 'Block Asha Rao' })).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('confirms Block and hides the memory immediately', async () => {
    const services = testServices();
    const block = jest.spyOn(services.repos.safety, 'block');
    const alert = pressConfirm('Block');
    await setup('memory-1', services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Block Asha Rao' }));
    expect(alert).toHaveBeenCalledWith(
      'Block Asha Rao?',
      "You won't see their memories, and they can't tag, invite or transfer to you.",
      [
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Block', style: 'destructive' }),
      ],
    );
    expect(await screen.findByText('This memory is no longer available.')).toBeOnTheScreen();
    expect(screen.queryByText(ASHA_TEXT)).toBeNull();
    expect(block).toHaveBeenCalledWith('user-demo', 'user-asha', services.now());
  });

  it('Cancel does not block', async () => {
    const services = testServices();
    const block = jest.spyOn(services.repos.safety, 'block');
    pressConfirm('Cancel');
    await setup('memory-1', services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Block Asha Rao' }));
    expect(block).not.toHaveBeenCalled();
    expect(screen.getByText(ASHA_TEXT)).toBeOnTheScreen();
  });

  it('shows generic copy when blocking fails', async () => {
    const services = testServices();
    jest.spyOn(services.repos.safety, 'block').mockRejectedValue(new Error('offline'));
    pressConfirm('Block');
    await setup('memory-1', services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Block Asha Rao' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByText(ASHA_TEXT)).toBeOnTheScreen();
  });

  it('shows the author a Hidden after reports badge', async () => {
    const services = testServices();
    const real = services.repos.memories.findById.bind(services.repos.memories);
    jest.spyOn(services.repos.memories, 'findById').mockImplementation(async (id) => {
      const m = await real(id);
      return m ? { ...m, moderation: 'hidden' } : m;
    });
    await setup('memory-2', services);
    expect(await screen.findByText('Hidden after reports')).toBeOnTheScreen();
  });

  it('shows no hidden badge for an unmoderated memory', async () => {
    await setup('memory-2');
    await screen.findByText('Edit');
    expect(screen.queryByText('Hidden after reports')).toBeNull();
  });
});

describe('MemoryCard', () => {
  async function renderCard(services: Services, memory: Memory, authorName?: string) {
    return render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <MemoryCard memory={memory} authorName={authorName} />
        </BlocksProvider>
      </ServicesProvider>,
    );
  }

  async function signedIn() {
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    return services;
  }

  it('shows Hidden after reports on a hidden memory to its author only', async () => {
    const services = await signedIn();
    const own = (await services.repos.memories.findById('memory-2'))!;
    let view = await renderCard(services, { ...own, moderation: 'hidden' });
    expect(await screen.findByText('Hidden after reports')).toBeOnTheScreen();
    await view.unmount();
    view = await renderCard(services, own);
    expect(screen.queryByText('Hidden after reports')).toBeNull();
    await view.unmount();
    // Someone else's hidden memory (e.g. a stale list entry) never shows the author-only badge.
    const other = (await services.repos.memories.findById('memory-1'))!;
    await renderCard(services, { ...other, moderation: 'hidden' });
    await act(async () => {});
    expect(screen.getByTestId('memory-memory-1')).toBeOnTheScreen();
    expect(screen.queryByText('Hidden after reports')).toBeNull();
  });

  it('navigates to the memory detail when pressed', async () => {
    const services = await signedIn();
    const memory = await services.repos.memories.findById('memory-2');
    await renderCard(services, memory!);
    await fireEvent.press(screen.getByTestId('memory-memory-2'));
    expect(mockPush).toHaveBeenCalledWith('/memory/memory-2');
  });

  it('shows the author name it is given', async () => {
    const services = await signedIn();
    const memory = (await services.repos.memories.findById('memory-2'))!;
    await renderCard(services, memory, 'Demo Custodian');
    expect(screen.getByText('Demo Custodian')).toBeOnTheScreen();
  });

  it('shows a Voice note indicator only with audio', async () => {
    const services = await signedIn();
    const memory = (await services.repos.memories.findById('memory-2'))!;
    const view = await renderCard(services, { ...memory, audioUrl: 'https://audio/2.m4a' });
    expect(screen.getByText('Voice note')).toBeOnTheScreen();
    await view.unmount();
    await renderCard(services, { ...memory, audioUrl: null });
    expect(screen.queryByText('Voice note')).toBeNull();
  });
});
