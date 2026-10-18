import { AudioModule, createAudioPlayer, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import type { AudioRecorder } from 'expo-audio';

import type { AudioPlayerService, AudioRecorderService } from './types';

let recorder: AudioRecorder | null = null;

/** HIGH_QUALITY is AAC in an `.m4a` container on both platforms. */
export const expoAudioRecorder: AudioRecorderService = {
  async requestPermission() {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    return granted ? 'granted' : 'denied';
  },
  async start() {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    // Non-hook construction; the namespace lint rule cannot see the class on the native module type.
    // eslint-disable-next-line import/namespace
    recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await recorder.prepareToRecordAsync();
    recorder.record();
  },
  async stop() {
    const r = recorder;
    recorder = null;
    if (!r) return null;
    const durationMs = Math.round(r.currentTime * 1000);
    await r.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const uri = r.uri;
    r.release();
    return uri ? { uri, durationMs } : null;
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
