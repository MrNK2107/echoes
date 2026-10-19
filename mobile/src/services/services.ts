import type { Repositories } from '@/data/types';
import type {
  AudioPlayerService,
  AudioRecorderService,
  ConnectivityService,
  FileStore,
  ImagePickerService,
  KeyValueStore,
  LocationService,
  PushService,
} from '@/device/types';

import type { AppConfig } from './config';

/** The composition root's product. Kept in its own module so fakes can import the type without expo modules. */
export interface Services {
  config: AppConfig;
  repos: Repositories;
  location: LocationService;
  imagePicker: ImagePickerService;
  connectivity: ConnectivityService;
  keyValue: KeyValueStore;
  files: FileStore;
  audioRecorder: AudioRecorderService;
  audioPlayer: AudioPlayerService;
  push: PushService;
  now(): Date;
  newId(): string;
}
