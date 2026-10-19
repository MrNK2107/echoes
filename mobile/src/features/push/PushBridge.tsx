import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { routeForNotification } from '@/features/inbox/routeForNotification';
import { useServices } from '@/services/ServicesProvider';

import { registerDevice } from './pushDevice';

/** Signed-in only: registers this device when permission is already granted, and routes notification taps. */
export function PushBridge({ uid }: { uid: string }) {
  const services = useServices();
  const router = useRouter();
  const { push } = services;

  useEffect(() => {
    if (push.availability() !== 'available') return;
    let cancelled = false;
    push
      .permission()
      .then((p) => (p === 'granted' && !cancelled ? registerDevice(services, uid) : undefined))
      .catch((e: unknown) => console.warn('Could not register for push', e));
    return () => {
      cancelled = true;
    };
  }, [push, services, uid]);

  useEffect(() => push.onResponse((data) => router.push(routeForNotification(data))), [push, router]);

  return null;
}
