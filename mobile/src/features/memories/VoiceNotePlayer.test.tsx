import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { fakeAudioPlayer, testServices } from '@/device/fakes';
import type { AudioPlayerService, AudioPlaybackStatus } from '@/device/types';
import { ServicesProvider } from '@/services/ServicesProvider';

import { VoiceNotePlayer } from './VoiceNotePlayer';

async function setup(audioPlayer: AudioPlayerService) {
  return render(
    <ServicesProvider services={testServices({ audioPlayer })}>
      <VoiceNotePlayer url="https://audio/1.m4a" />
    </ServicesProvider>,
  );
}

function controllablePlayer() {
  let emit: (s: AudioPlaybackStatus) => void = () => {};
  const player: AudioPlayerService = {
    load: () => ({
      play: () => {},
      pause: () => {},
      release: () => {},
      onStatus: (cb) => {
        emit = cb;
        return () => {};
      },
    }),
  };
  return { player, emit: (s: AudioPlaybackStatus) => emit(s) };
}

describe('VoiceNotePlayer', () => {
  it('toggles between play and pause', async () => {
    const player = fakeAudioPlayer();
    await setup(player);
    expect(screen.getByText('Voice note')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Play voice note'));
    expect(await screen.findByLabelText('Pause voice note')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Pause voice note'));
    expect(await screen.findByLabelText('Play voice note')).toBeOnTheScreen();
    expect(player.calls).toEqual(['load:https://audio/1.m4a', 'play', 'pause']);
  });

  it('shows the error copy when playback fails', async () => {
    const c = controllablePlayer();
    await setup(c.player);
    await act(async () => c.emit({ playing: false, error: true, finished: false }));
    expect(screen.getByText('Voice note unavailable')).toBeOnTheScreen();
  });

  it('resets to play when playback finishes', async () => {
    const c = controllablePlayer();
    await setup(c.player);
    await act(async () => c.emit({ playing: true, error: false, finished: false }));
    expect(screen.getByLabelText('Pause voice note')).toBeOnTheScreen();
    await act(async () => c.emit({ playing: false, error: false, finished: true }));
    expect(screen.getByLabelText('Play voice note')).toBeOnTheScreen();
  });

  it('releases the player on unmount', async () => {
    const player = fakeAudioPlayer();
    const view = await setup(player);
    await view.unmount();
    expect(player.calls).toContain('release');
  });
});
