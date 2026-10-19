import { createMemoryBackend } from '@/data/memory';
import { buildSeed, DEMO_CENTER } from '@/data/seed';
import type { LatLng } from '@/domain/types';
import { readConfig } from '@/services/config';
import type { Services } from '@/services/services';

import type {
  AudioPlaybackStatus,
  AudioPlayerService,
  AudioRecorderService,
  ConnectivityService,
  FileStore,
  ImagePickerService,
  KeyValueStore,
  LocationService,
  PushAvailability,
  PushPermission,
  PushService,
} from './types';

export const SEED_CENTER: LatLng = DEMO_CENTER;
export const TEST_NOW = new Date('2026-10-18T09:00:00Z');

export function fakeLocation(
  r: { permission?: 'granted' | 'denied'; position?: LatLng; error?: Error } = {},
): LocationService {
  return {
    requestPermission: async () => r.permission ?? 'granted',
    getCurrentPosition: async () => {
      if (r.error) throw r.error;
      return r.position ?? SEED_CENTER;
    },
  };
}

export function fakeImagePicker(result: Awaited<ReturnType<ImagePickerService['pick']>>): ImagePickerService {
  return { pick: async () => result };
}

export function fakeConnectivity(initial = true): ConnectivityService & { setOnline(online: boolean): void } {
  let online = initial;
  const listeners = new Set<(online: boolean) => void>();
  return {
    isOnline: async () => online,
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    setOnline(next) {
      online = next;
      listeners.forEach((cb) => cb(next));
    },
  };
}

export function memoryKeyValue(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    get: async (key) => map.get(key) ?? null,
    set: async (key, value) => {
      map.set(key, value);
    },
    remove: async (key) => {
      map.delete(key);
    },
  };
}

export function fakeFiles(): FileStore {
  return {
    persist: async (_uri, name) => `persisted://${name}`,
    remove: async () => {},
  };
}

export function fakeAudioRecorder(
  r: { permission?: 'granted' | 'denied'; result?: { uri: string; durationMs: number } | null } = {},
): AudioRecorderService {
  return {
    requestPermission: async () => r.permission ?? 'granted',
    start: async () => {},
    stop: async () => r.result ?? null,
  };
}

export function fakeAudioPlayer(): AudioPlayerService & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    load(url) {
      calls.push(`load:${url}`);
      const listeners = new Set<(s: AudioPlaybackStatus) => void>();
      const emit = (playing: boolean) =>
        listeners.forEach((cb) => cb({ playing, error: false, finished: false }));
      return {
        play() {
          calls.push('play');
          emit(true);
        },
        pause() {
          calls.push('pause');
          emit(false);
        },
        release() {
          calls.push('release');
        },
        onStatus(cb) {
          listeners.add(cb);
          return () => {
            listeners.delete(cb);
          };
        },
      };
    },
  };
}

export interface FakePush extends PushService {
  calls: string[];
  /** Simulates the user tapping a notification. */
  emitResponse(data: Record<string, string>): void;
}

export function fakePush(
  r: {
    availability?: PushAvailability;
    permission?: PushPermission;
    /** What the system prompt answers. */
    grant?: 'granted' | 'denied';
    token?: string | null;
  } = {},
): FakePush {
  const calls: string[] = [];
  let permission: PushPermission = r.permission ?? 'undetermined';
  const listeners = new Set<(d: Record<string, string>) => void>();
  return {
    calls,
    availability: () => r.availability ?? 'available',
    permission: async () => permission,
    async request() {
      calls.push('request');
      const result = r.grant ?? 'granted';
      permission = result;
      return result;
    },
    token: async () => (r.token === undefined ? 'ExponentPushToken[fake]' : r.token),
    onResponse(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    async openSettings() {
      calls.push('openSettings');
    },
    emitResponse: (data) => listeners.forEach((cb) => cb(data)),
  };
}

export function testServices(overrides: Partial<Services> = {}): Services {
  let n = 0;
  const now = overrides.now ?? (() => new Date(TEST_NOW));
  return {
    config: readConfig({}),
    repos: createMemoryBackend(buildSeed(new Date(TEST_NOW), SEED_CENTER), { now }),
    location: fakeLocation({}),
    imagePicker: fakeImagePicker(null),
    connectivity: fakeConnectivity(),
    keyValue: memoryKeyValue(),
    files: fakeFiles(),
    audioRecorder: fakeAudioRecorder(),
    audioPlayer: fakeAudioPlayer(),
    push: fakePush(),
    now,
    newId: () => `id-${++n}`,
    ...overrides,
  };
}
