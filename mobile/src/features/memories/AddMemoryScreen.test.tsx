import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { fakeAudioRecorder, fakeConnectivity, fakeImagePicker, fakeLocation, testServices } from '@/device/fakes';
import type { Memory } from '@/domain/types';
import { OutboxProvider } from '@/features/outbox/useOutbox';
import { BlocksProvider } from '@/features/safety/BlocksProvider';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { AddMemoryScreen, QUEUED_NOTICE_MS } from './AddMemoryScreen';
import { SUBMIT_TIMEOUT_MS } from './submitMemory';

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
      <BlocksProvider>
        <OutboxProvider userId="user-demo">
          <AddMemoryScreen />
        </OutboxProvider>
      </BlocksProvider>
    </ServicesProvider>,
  );
  return services;
}

describe('AddMemoryScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts with the default privacy of a user whose default is private', async () => {
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
      await services.repos.users.updateDefaultPrivacy('user-demo', 'private', services.now());
    });
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <OutboxProvider userId="user-demo">
            <AddMemoryScreen />
          </OutboxProvider>
        </BlocksProvider>
      </ServicesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('privacy-private').props.accessibilityState).toMatchObject({ selected: true }),
    );
  });

  it('disables Save until the default privacy resolves', async () => {
    const services = testServices();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const get = services.repos.users.get.bind(services.repos.users);
    jest.spyOn(services.repos.users, 'get').mockImplementation(async (id) => {
      await gate;
      return get(id);
    });
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <OutboxProvider userId="user-demo">
            <AddMemoryScreen />
          </OutboxProvider>
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(screen.getByTestId('save-button').props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => {
      release();
    });
    await waitFor(() =>
      expect(screen.getByTestId('save-button').props.accessibilityState).toMatchObject({ disabled: false }),
    );
    expect(screen.getByTestId('privacy-public').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('defaults to Private when the user lookup fails', async () => {
    const services = testServices();
    jest.spyOn(services.repos.users, 'get').mockRejectedValue(new Error('x'));
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <OutboxProvider userId="user-demo">
            <AddMemoryScreen />
          </OutboxProvider>
        </BlocksProvider>
      </ServicesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('save-button').props.accessibilityState).toMatchObject({ disabled: false }),
    );
    expect(screen.getByTestId('privacy-private').props.accessibilityState).toMatchObject({ selected: true });
  });

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

  it('uploads a recorded voice note with the memory', async () => {
    const services = await setup({
      audioRecorder: fakeAudioRecorder({ result: { uri: 'file:///v.m4a', durationMs: 3000 } }),
    });
    const upload = jest.spyOn(services.repos.media, 'uploadMemoryAudio').mockResolvedValue('https://audio/v.m4a');
    await fireEvent.changeText(screen.getByTestId('text-input'), 'with a voice');
    await fireEvent.press(screen.getByText('Public'));
    await fireEvent.press(screen.getByTestId('use-location-button'));
    await screen.findByText('Location captured');
    await fireEvent.press(screen.getByText('Record voice note'));
    await fireEvent.press(await screen.findByText('Stop'));
    await screen.findByText('Voice note ready (3s)');
    await fireEvent.press(screen.getByTestId('save-button'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ localUri: 'file:///v.m4a' }));
  });

  it('explains denied location permission', async () => {
    await setup({ location: fakeLocation({ permission: 'denied' }) });
    await fireEvent.press(screen.getByTestId('use-location-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Location permission is needed to save a memory here.');
  });

  it('offers all five privacy segments', async () => {
    await setup();
    for (const label of ['Public', 'Private', 'Time release', 'Tagged', 'Community']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it('saves a tagged memory with the picked taggedUserIds', async () => {
    const base = testServices();
    const create = jest.spyOn(base.repos.memories, 'create');
    await setup({ repos: base.repos });
    await fireEvent.changeText(screen.getByTestId('text-input'), 'Coffee with Rohan');
    await fireEvent.press(screen.getByText('Tagged'));
    await fireEvent.press(screen.getByTestId('use-location-button'));
    await screen.findByText('Location captured');
    await fireEvent.press(screen.getByTestId('save-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one tagged user.');
    expect(create).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Search people'), 'Ro');
    await fireEvent.press(await screen.findByText('Rohan Mehta'));
    expect(screen.getByTestId('chip-user-rohan')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('save-button'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ privacy: 'tagged', taggedUserIds: ['user-rohan'], communityId: null }),
    );
  });

  it('saves a community memory with the chosen communityId', async () => {
    const base = testServices();
    const create = jest.spyOn(base.repos.memories, 'create');
    await setup({ repos: base.repos });
    await fireEvent.changeText(screen.getByTestId('text-input'), 'Walkers meet-up');
    await fireEvent.press(screen.getByText('Community'));
    expect(await screen.findByText('Choose a community')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('use-location-button'));
    await screen.findByText('Location captured');
    await fireEvent.press(screen.getByTestId('save-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a community.');

    await fireEvent.press(await screen.findByText('Cubbon Park Walkers'));
    expect(screen.getByTestId('community-community-cubbon-walkers')).toBeSelected();
    await fireEvent.press(screen.getByTestId('save-button'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        privacy: 'community',
        communityId: 'community-cubbon-walkers',
        taggedUserIds: [],
      }),
    );
  });

  it('asks to join a community first when the user has none', async () => {
    const base = testServices();
    jest.spyOn(base.repos.communities, 'subscribeMine').mockImplementation((_uid, cb) => {
      cb([]);
      return () => {};
    });
    await setup({ repos: base.repos });
    await fireEvent.press(screen.getByText('Community'));
    expect(await screen.findByText('Join a community first.')).toBeOnTheScreen();
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

  async function fillAndLocate() {
    await fireEvent.changeText(screen.getByTestId('text-input'), 'Retry me safely');
    await fireEvent.press(screen.getByTestId('use-location-button'));
    await screen.findByText('Location captured');
  }

  describe('submit reliability', () => {
    afterEach(() => jest.useRealTimers());

    it('queues the draft after 15 s, tells the user, and returns to the map', async () => {
      const base = testServices({ connectivity: fakeConnectivity(false) });
      const create = jest.fn((_m: Memory) => new Promise<void>(() => {}));
      const services = await setup({
        connectivity: base.connectivity,
        repos: { ...base.repos, memories: { ...base.repos.memories, create } },
      });
      await fillAndLocate();
      jest.useFakeTimers();

      await act(async () => {
        void fireEvent.press(screen.getByTestId('save-button'));
        await jest.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
      });
      expect(await screen.findByText("Saved offline. It will upload when you're back online.")).toBeOnTheScreen();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(mockReplace).not.toHaveBeenCalled();
      const queued = JSON.parse((await services.keyValue.get('outbox:user-demo'))!) as { memoryId: string }[];
      expect(queued.map((d) => d.memoryId)).toEqual([create.mock.calls[0]![0].id]);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(QUEUED_NOTICE_MS);
      });
      expect(mockReplace).toHaveBeenCalledWith('/');
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('shows a validation error without queueing', async () => {
      const services = await setup();
      await fireEvent.changeText(screen.getByTestId('text-input'), 'no location yet');
      await fireEvent.press(screen.getByTestId('save-button'));
      expect(await screen.findByRole('alert')).toHaveTextContent('Capture location before saving.');
      expect(await services.keyValue.get('outbox:user-demo')).toBeNull();
    });

    it('starts only one submit for two taps in the same tick', async () => {
      const base = testServices();
      const create = jest.spyOn(base.repos.memories, 'create');
      await setup({ repos: base.repos });
      await fillAndLocate();
      const { onClick: onPress } = screen.getByTestId('save-button').props as { onClick: () => Promise<void> };
      await act(async () => {
        void onPress();
        void onPress();
      });
      await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
      expect(create).toHaveBeenCalledTimes(1);
    });
  });
});

describe('AddMemoryScreen profanity check', () => {
  const WARNING = 'This memory may contain offensive language. Save anyway?';
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  async function fillProfane() {
    await fireEvent.changeText(screen.getByTestId('text-input'), 'What a sh1t day at the park');
    await fireEvent.press(screen.getByTestId('use-location-button'));
    await screen.findByText('Location captured');
  }

  function answer(label: string) {
    return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === label)?.onPress?.();
    });
  }

  it('Edit keeps the form and saves nothing', async () => {
    const base = testServices();
    const create = jest.spyOn(base.repos.memories, 'create');
    const alert = answer('Edit');
    await setup({ repos: base.repos });
    await fillProfane();
    await fireEvent.press(screen.getByTestId('save-button'));
    expect(alert).toHaveBeenCalledWith(WARNING, undefined, [
      expect.objectContaining({ text: 'Edit', style: 'cancel' }),
      expect.objectContaining({ text: 'Save anyway' }),
    ]);
    expect(create).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId('text-input').props.value).toBe('What a sh1t day at the park');
    expect(screen.getByTestId('save-button')).toBeEnabled();
  });

  it('Save anyway saves the memory', async () => {
    const base = testServices();
    const create = jest.spyOn(base.repos.memories, 'create');
    answer('Save anyway');
    await setup({ repos: base.repos });
    await fillProfane();
    await fireEvent.press(screen.getByTestId('save-button'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0].textContent).toBe('What a sh1t day at the park');
  });

  it('runs the form validation before asking about the wording', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await setup();
    await fireEvent.changeText(screen.getByTestId('text-input'), 'What a sh1t day at the park');
    await fireEvent.press(screen.getByTestId('save-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Capture location before saving.');
    expect(alert).not.toHaveBeenCalled();
  });

  it('reports an invalid privacy choice before asking about the wording', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await setup();
    await fireEvent.changeText(screen.getByTestId('text-input'), 'What a sh1t day at the park');
    await fireEvent.press(screen.getByTestId('use-location-button'));
    await screen.findByText('Location captured');
    await fireEvent.press(screen.getByTestId('privacy-tagged'));
    await fireEvent.press(screen.getByTestId('save-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one tagged user.');
    expect(alert).not.toHaveBeenCalled();
  });

  it('does not ask for clean text', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await setup();
    await fireEvent.changeText(screen.getByTestId('text-input'), 'A lovely clean day');
    await fireEvent.press(screen.getByTestId('use-location-button'));
    await screen.findByText('Location captured');
    await fireEvent.press(screen.getByTestId('save-button'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(alert).not.toHaveBeenCalled();
  });
});
