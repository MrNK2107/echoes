import type { ComponentType } from 'react';

import type { ArScenePlace } from '@/domain/arScene';
import type { LatLng } from '@/domain/types';

export interface LocationService {
  requestPermission(): Promise<'granted' | 'denied'>;
  getCurrentPosition(): Promise<LatLng>;
}

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
  fileSize: number | null;
}

export interface ImagePickerService {
  /** null = cancelled. */
  pick(source: 'camera' | 'library'): Promise<PickedImage | null>;
}

export interface ConnectivityService {
  isOnline(): Promise<boolean>;
  /** Returns an unsubscribe function. */
  subscribe(cb: (online: boolean) => void): () => void;
}

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface FileStore {
  /** Copies the file into `<documentDirectory>/outbox/<name>` and returns the new uri. */
  persist(uri: string, name: string): Promise<string>;
  /** Deletes the file; a missing file is not an error. */
  remove(uri: string): Promise<void>;
}

export interface AudioRecorderService {
  requestPermission(): Promise<'granted' | 'denied'>;
  start(): Promise<void>;
  /** AAC `.m4a`; null when nothing was recorded. */
  stop(): Promise<{ uri: string; durationMs: number } | null>;
}

export interface AudioPlaybackStatus {
  playing: boolean;
  error: boolean;
  finished: boolean;
}

export interface AudioPlayerHandle {
  play(): void;
  pause(): void;
  release(): void;
  onStatus(cb: (s: AudioPlaybackStatus) => void): () => void;
}

export interface AudioPlayerService {
  load(url: string): AudioPlayerHandle;
}

export type PushAvailability = 'available' | 'expo-go' | 'simulator';
export type PushPermission = 'granted' | 'denied' | 'undetermined';

export interface PushService {
  availability(): PushAvailability;
  permission(): Promise<PushPermission>;
  request(): Promise<'granted' | 'denied'>;
  /** The Expo push token; null when unavailable or not granted. */
  token(): Promise<string | null>;
  /** Notification taps (cold start once, then warm); data is `{ type, notificationId, ...data }`. Returns unsubscribe. */
  onResponse(cb: (data: Record<string, string>) => void): () => void;
  openSettings(): Promise<void>;
}

export interface HeadingService {
  /** Degrees clockwise from north. Rejects or resolves null when no compass is available. */
  subscribe(cb: (degrees: number) => void): Promise<() => void>;
}

export interface CrashReporter {
  init(): void;
  captureException(e: unknown, context?: Record<string, string>): void;
}

export interface ArSceneProps {
  places: (ArScenePlace & { name: string; color: string; memoryIds: string[] })[];
  heading: number;
  onPressPlace(placeId: string): void;
  onPressOrb(memoryId: string): void;
  onTrackingError(): void;
}

export type ArStatus = 'available' | 'missing' | 'unsupported';

export interface ArRenderer {
  status(): Promise<ArStatus>;
  requestCamera(): Promise<'granted' | 'denied'>;
  /** The AR scene component; null until the native AR library is bundled. */
  Scene: ComponentType<ArSceneProps> | null;
}
