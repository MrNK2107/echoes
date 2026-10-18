import { AudioModule, createAudioPlayer, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import type { AudioRecorder } from 'expo-audio';

import type { AudioPlayerService, AudioRecorderService } from './types';

let recorder: AudioRecorder | null = null;
let starting = false;

/** HIGH_QUALITY is AAC in an `.m4a` container on both platforms. */
export const expoAudioRecorder: AudioRecorderService = {
  async requestPermission() {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    return granted ? 'granted' : 'denied';
  },
  async start() {
    if (recorder || starting) return;
    starting = true;
    let candidate: AudioRecorder | null = null;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      // Non-hook construction; the namespace lint rule cannot see the class on the native module type.
      // eslint-disable-next-line import/namespace
      candidate = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await candidate.prepareToRecordAsync();
      candidate.record();
      recorder = candidate;
    } catch (e) {
      candidate?.release();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      throw e;
    } finally {
      starting = false;
    }
  },
  async stop() {
    const r = recorder;
    recorder = null;
    if (!r) return null;
    const before = r.currentTime;
    try {
      await r.stop();
      const durationMs = Math.round(Math.max(before, r.currentTime) * 1000);
      const uri = r.uri;
      return uri ? { uri, durationMs } : null;
    } finally {
      r.release();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  },
};

export const expoAudioPlayer: AudioPlayerService = {
  load(url) {
    const player = createAudioPlayer(url);
    return {
      play: () => player.play(),
      pause: () => player.pause(),
      release: () => player.remove(),
      onStatus(cb) {
        const sub = player.addListener('playbackStatusUpdate', (s) =>
          cb({ playing: s.playing, error: s.error != null, finished: s.didJustFinish }),
        );
        return () => sub.remove();
      },
    };
  },
};
