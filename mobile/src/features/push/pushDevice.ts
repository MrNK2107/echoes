import { Platform } from 'react-native';

import type { PushService } from '@/device/types';
import { withTimeout } from '@/features/memories/submitMemory';
import type { Services } from '@/services/services';

/** Unregistering must never hold up sign-out. */
export const UNREGISTER_TIMEOUT_MS = 3000;

/** The token this app instance registered, so sign-out can remove it. Keyed by the push service. */
const registered = new WeakMap<PushService, { uid: string; token: string }>();

/** Fetches this device's push token and stores it for the user; no-op when there is no token. */
export async function registerDevice(services: Services, uid: string): Promise<void> {
  const token = await services.push.token();
  if (!token) return;
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  await services.repos.pushTokens.register(uid, token, platform, services.now());
  registered.set(services.push, { uid, token });
}

/** Removes this device's token (best effort, short timeout), then signs out. */
export async function signOutDevice(services: Services): Promise<void> {
  const entry = registered.get(services.push);
  if (entry) {
    registered.delete(services.push);
    try {
      await withTimeout(services.repos.pushTokens.unregister(entry.uid, entry.token), UNREGISTER_TIMEOUT_MS);
    } catch (e) {
      console.warn('Could not unregister the push token', e);
    }
  }
  await services.repos.auth.signOut();
}
