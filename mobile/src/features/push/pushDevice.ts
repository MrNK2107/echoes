import { Platform } from 'react-native';

import type { PushService } from '@/device/types';
import { withTimeout } from '@/features/memories/submitMemory';
import type { Services } from '@/services/services';

/** Unregistering must never hold up sign-out. */
export const UNREGISTER_TIMEOUT_MS = 3000;
/** Registration must not hang forever on a stuck token lookup. */
export const TOKEN_TIMEOUT_MS = 10_000;
/** A successful registration is not repeated for the same user and permission within this window. */
export const REGISTER_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface DeviceState {
  /** The token this app instance registered, so sign-out can remove it without a lookup. */
  entry?: { uid: string; token: string };
  /** Bumped by every sign-out; a registration that started earlier must not outlive it. */
  epoch: number;
  /** The last successful registration, for the throttle. */
  last?: { uid: string; at: number; permission: string };
  /** Cancels the pending "retry when back online" subscription, if any. */
  cancelRetry?: () => void;
  /** The attempt in flight, shared by concurrent callers of the same user. */
  inflight?: { uid: string; promise: Promise<void> };
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

/** After a failed registration: one retry on the first online event, then the subscription is gone. */
function retryWhenOnline(services: Services, uid: string, state: DeviceState): void {
  if (state.cancelRetry) return;
  let done = false;
  let unsubscribe: (() => void) | undefined;
  const cancel = () => {
    if (done) return;
    done = true;
    unsubscribe?.();
    state.cancelRetry = undefined;
  };
  state.cancelRetry = cancel;
  unsubscribe = services.connectivity.subscribe((online) => {
    if (!online || done) return;
    cancel();
    attempt(services, uid, false).catch((e: unknown) => console.warn('Could not register for push', e));
  });
  if (done) unsubscribe();
}

async function attempt(services: Services, uid: string, armRetry: boolean, force = false): Promise<void> {
  const state = stateOf(services.push);
  const epoch = state.epoch;
  try {
    const permission = await services.push.permission();
    const last = state.last;
    if (
      !force &&
      last &&
      last.uid === uid &&
      last.permission === permission &&
      services.now().getTime() - last.at < REGISTER_MIN_INTERVAL_MS
    ) {
      return;
    }
    const token = await withTimeout(services.push.token(), TOKEN_TIMEOUT_MS);
    if (!token || state.epoch !== epoch) return;
    // Cached before the write so a sign-out during the write still knows what to remove.
    state.entry = { uid, token };
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const at = services.now();
    await services.repos.pushTokens.register(uid, token, platform, at);
    if (state.epoch !== epoch) {
      // Signed out while the write was in flight: take the token back out.
      await bestEffortUnregister(services, uid, token);
      return;
    }
    state.last = { uid, at: at.getTime(), permission };
  } catch (e) {
    if (armRetry && state.epoch === epoch) retryWhenOnline(services, uid, state);
    throw e;
  }
}

/**
 * Fetches this device's push token and stores it for the user; no-op when there is no token.
 * Skipped when this user registered successfully within 6 h and the permission is unchanged. A
 * `force` skips that check (permission just granted). A failure subscribes once to connectivity and retries on the first online event.
 */
export function registerDevice(
  services: Services,
  uid: string,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  const state = stateOf(services.push);
  if (state.inflight?.uid === uid) return state.inflight.promise;
  const promise = attempt(services, uid, true, force).finally(() => {
    if (state.inflight?.promise === promise) state.inflight = undefined;
  });
  state.inflight = { uid, promise };
  return promise;
}

/** Removes this device's token for `uid` (best effort, one short timeout), then always signs out. */
export async function signOutDevice(services: Services, uid: string): Promise<void> {
  const { push, repos } = services;
  const state = stateOf(push);
  state.epoch += 1;
  state.cancelRetry?.();
  state.last = undefined;
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
