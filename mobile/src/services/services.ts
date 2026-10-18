import type { Repositories } from '@/data/types';
import type { ImagePickerService, LocationService } from '@/device/types';

import type { AppConfig } from './config';

/** The composition root's product. Kept in its own module so fakes can import the type without expo modules. */
export interface Services {
  config: AppConfig;
  repos: Repositories;
  location: LocationService;
  imagePicker: ImagePickerService;
  now(): Date;
  newId(): string;
}
