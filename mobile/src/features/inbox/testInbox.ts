import { DEMO_USER } from '@/data/seed';
import type { AppNotification, NotificationRepository } from '@/data/types';
import { testServices } from '@/device/fakes';
import type { Services } from '@/services/services';

export function note(over: Partial<AppNotification> & { id: string }): AppNotification {
  return {
    type: 'memoryTagged',
    title: 'Tagged in a memory',
    body: 'Someone tagged you in a memory.',
    data: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    readAt: null,
    ...over,
  };
}

/** Services whose inbox is a controllable list (newest first, as the repository emits it). */
export async function inboxServices(initial: AppNotification[]) {
  let list = initial;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const notifications: NotificationRepository = {
    subscribe(_uid, cb) {
      const l = () => cb(list);
      listeners.add(l);
      l();
      return () => {
        listeners.delete(l);
      };
    },
    markRead: jest.fn(async (_uid: string, id: string, at: Date) => {
      list = list.map((n) => (n.id === id ? { ...n, readAt: at } : n));
      emit();
    }),
    markAllRead: jest.fn(async (_uid: string, at: Date) => {
      list = list.map((n) => (n.readAt ? n : { ...n, readAt: at }));
      emit();
    }),
  };
  const base = testServices();
  const services: Services = { ...base, repos: { ...base.repos, notifications } };
  await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  return { services, notifications };
}
