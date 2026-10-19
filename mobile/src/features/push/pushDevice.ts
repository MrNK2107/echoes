import { Platform } from 'react-native';

import type { PushService } from '@/device/types';
import { withTimeout } from '@/features/memories/submitMemory';
import type { Services } from '@/services/services';

/** Unregistering must never hold up sign-out. */
export const UNREGISTER_TIMEOUT_MS = 3000;
/** Registration must not hang forever on a stuck token lookup. */
export const TOKEN_TIMEOUT_MS = 10_000;

interface DeviceState {
  /** The token this app instance registered, so sign-out can remove it without a lookup. */
  entry?: { uid: string; token: string };
  /** Bumped by every sign-out; a registration that started earlier must not outlive it. */
  epoch: number;
}
const states = new WeakMap<PushService, DeviceState>();
const stateOf = (push: PushService): DeviceState => {
  let s = states.get(push);
  if (!s) states.set(push, (s = { epoch: 0 }));
  return s;
};

async function bestEffortUnregister(services: Services, uid: string, token: string): Promise<void> {
  try {
    await services.repos.pushTokens.unregister(uid, token);
  } catch (e) {
    console.warn('Could not unregister the push token', e);
  }
}

/** Fetches this device's push token and stores it for the user; no-op when there is no token. */
export async function registerDevice(services: Services, uid: string): Promise<void> {
  const state = stateOf(services.push);
  const epoch = state.epoch;
  const token = await withTimeout(services.push.token(), TOKEN_TIMEOUT_MS);
  if (!token || state.epoch !== epoch) return;
  // Cached before the write so a sign-out during the write still knows what to remove.
  state.entry = { uid, token };
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  await services.repos.pushTokens.register(uid, token, platform, services.now());
  if (state.epoch !== epoch) {
    // Signed out while the write was in flight: take the token back out.
    await bestEffortUnregister(services, uid, token);
  }
}

/** Removes this device's token for `uid` (best effort, one short timeout), then always signs out. */
export async function signOutDevice(services: Services, uid: string): Promise<void> {
  const { push, repos } = services;
  const state = stateOf(push);
  state.epoch += 1;
  try {
    await withTimeout(
      (async () => {
        let token = state.entry?.uid === uid ? state.entry.token : null;
        if (!token && push.availability() === 'available' && (await push.permission()) === 'granted') {
          token = await push.token();
        }
        if (token) await repos.pushTokens.unregister(uid, token);
      })(),
      UNREGISTER_TIMEOUT_MS,
    );
  } catch (e) {
    console.warn('Could not unregister the push token', e);
  }
  state.entry = undefined;
  await repos.auth.signOut();
}
