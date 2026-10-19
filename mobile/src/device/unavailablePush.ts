import type { PushService } from './types';

/** Used where push cannot work (demo mode): never touches native code. */
export const unavailablePush: PushService = {
  availability: () => 'expo-go',
  permission: async () => 'undetermined',
  request: async () => 'denied',
  token: async () => null,
  onResponse: () => () => {},
  openSettings: async () => {},
};
