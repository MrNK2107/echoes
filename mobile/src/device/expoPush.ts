import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Linking, Platform } from 'react-native';

import type { PushAvailability, PushPermission, PushService } from './types';

/**
 * expo-notifications is required lazily: Expo Go (SDK 53+) logs errors when it loads on Android,
 * and demo or unavailable builds never need it.
 */
type Notifications = typeof import('expo-notifications');
let loaded: Notifications | null = null;
function notifications(): Notifications {
  if (!loaded) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('expo-notifications') as Notifications;
    loaded.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
  return loaded;
}

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? null;
}

function availability(): PushAvailability {
  const inExpoGo =
    Constants.appOwnership === 'expo' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  // Without an EAS project id there is no push token to fetch; the Expo Go copy fits that case too.
  if (inExpoGo || !projectId()) return 'expo-go';
  if (!Device.isDevice) return 'simulator';
  return 'available';
}

function asStrings(data: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) if (v !== null && v !== undefined) out[k] = String(v);
  }
  return out;
}

async function ensureChannel(n: Notifications): Promise<void> {
  await n.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: n.AndroidImportance.DEFAULT,
  });
}

let coldStartHandled = false;

export const expoPush: PushService = {
  availability,
  async permission(): Promise<PushPermission> {
    if (availability() !== 'available') return 'undetermined';
    return (await notifications().getPermissionsAsync()).status;
  },
  async request() {
    if (availability() !== 'available') return 'denied';
    const n = notifications();
    if (Platform.OS === 'android') await ensureChannel(n);
    return (await n.requestPermissionsAsync()).status === 'granted' ? 'granted' : 'denied';
  },
  async token() {
    if (availability() !== 'available') return null;
    const n = notifications();
    if ((await n.getPermissionsAsync()).status !== 'granted') return null;
    if (Platform.OS === 'android') await ensureChannel(n);
    const id = projectId();
    if (!id) return null;
    return (await n.getExpoPushTokenAsync({ projectId: id })).data;
  },
  onResponse(cb) {
    if (availability() !== 'available') return () => {};
    const n = notifications();
    if (!coldStartHandled) {
      coldStartHandled = true;
      void n
        .getLastNotificationResponseAsync()
        .then((r) => {
          if (r) cb(asStrings(r.notification.request.content.data));
        })
        .catch(() => {});
    }
    const sub = n.addNotificationResponseReceivedListener((r) => cb(asStrings(r.notification.request.content.data)));
    return () => sub.remove();
  },
  async openSettings() {
    await Linking.openSettings();
  },
};
