import type { AppNotification } from '@/domain/types';
import { GENERIC_ERROR } from '../errors';
import type { NotificationRepository } from '../types';
import { emulateReleasedTagNotifications } from './notify';
import type { Store } from './store';

const LIST_LIMIT = 50;

export function createNotificationRepository(store: Store): NotificationRepository {
  const inbox = (uid: string) => store.notifications.get(uid) ?? new Map<string, AppNotification>();
  const setReadAt = (uid: string, ids: string[], at: Date) => {
    const items = inbox(uid);
    for (const id of ids) {
      const n = items.get(id);
      if (!n) throw new Error(GENERIC_ERROR);
      items.set(id, { ...n, readAt: at });
    }
    store.notify(store.notificationListeners);
  };
  return {
    subscribe(uid, cb) {
      const emit = () => {
        // The scheduled notifyReleasedTags job, run lazily (demo mode has no scheduler).
        emulateReleasedTagNotifications(store);
        cb(
          // Reversed first so that, within one millisecond, the later notification still leads.
          [...inbox(uid).values()]
            .reverse()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, LIST_LIMIT),
        );
      };
      store.notificationListeners.add(emit);
      emit();
      return () => { store.notificationListeners.delete(emit); };
    },
    async markRead(uid, id, at) {
      setReadAt(uid, [id], at);
    },
    async markAllRead(uid, at) {
      setReadAt(uid, [...inbox(uid).values()].filter((n) => n.readAt === null).map((n) => n.id), at);
    },
  };
}
