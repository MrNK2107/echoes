import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { routeForNotification } from '@/features/inbox/routeForNotification';
import { useServices } from '@/services/ServicesProvider';

import { registerDevice } from './pushDevice';

/**
 * Signed-in only: registers this device when permission is already granted (on mount and on every
 * foreground, throttled to once per 6 h inside registerDevice), and routes notification taps.
 */
export function PushBridge({ uid }: { uid: string }) {
  const services = useServices();
  const router = useRouter();
  const { push } = services;

  useEffect(() => {
    if (push.availability() !== 'available') return;
    let cancelled = false;
    const registerIfGranted = () =>
      push
        .permission()
        .then((p) => (p === 'granted' && !cancelled ? registerDevice(services, uid) : undefined))
        .catch((e: unknown) => console.warn('Could not register for push', e));
    void registerIfGranted();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void registerIfGranted();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [push, services, uid]);

  const { repos, now } = services;
  useEffect(
    () =>
      push.onResponse((data) => {
        // Best effort: a failed read receipt never blocks routing.
        if (data.notificationId) {
          void repos.notifications
            .markRead(uid, data.notificationId, now())
            .catch((e: unknown) => console.warn('Could not mark the notification read', e));
        }
        router.push(routeForNotification(data));
      }),
    [push, router, repos.notifications, now, uid],
  );

  return null;
}
