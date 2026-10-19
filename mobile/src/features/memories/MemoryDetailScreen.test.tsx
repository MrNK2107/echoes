import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { fakeAudioPlayer, testServices } from '@/device/fakes';
import { MemoryCard } from '@/features/places/MemoryCard';
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
      <MemoryDetailScreen memoryId={id} />
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

describe('MemoryCard', () => {
  it('navigates to the memory detail when pressed', async () => {
    const services = testServices();
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    const memory = await services.repos.memories.findById('memory-2');
    await render(<MemoryCard memory={memory!} />);
    await fireEvent.press(screen.getByTestId('memory-memory-2'));
    expect(mockPush).toHaveBeenCalledWith('/memory/memory-2');
  });

  it('shows the author name it is given', async () => {
    const services = testServices();
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    const memory = (await services.repos.memories.findById('memory-2'))!;
    await render(<MemoryCard memory={memory} authorName="Demo Custodian" />);
    expect(screen.getByText('Demo Custodian')).toBeOnTheScreen();
  });

  it('shows a Voice note indicator only with audio', async () => {
    const services = testServices();
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    const memory = (await services.repos.memories.findById('memory-2'))!;
    const view = await render(<MemoryCard memory={{ ...memory, audioUrl: 'https://audio/2.m4a' }} />);
    expect(screen.getByText('Voice note')).toBeOnTheScreen();
    await view.unmount();
    await render(<MemoryCard memory={{ ...memory, audioUrl: null }} />);
    expect(screen.queryByText('Voice note')).toBeNull();
  });
});
