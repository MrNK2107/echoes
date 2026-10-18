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
