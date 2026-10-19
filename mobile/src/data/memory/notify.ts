import { MAX_TAGS } from '@/domain/privacy';
import type { Memory, NotificationPrefs, NotificationType } from '@/domain/types';
import type { Store } from './store';
import { SOMEONE } from '@/ui/copy';

/**
 * In-process emulation of functions/lib/notify.js: the same templates, and the same skips for
 * self, blocks in either direction and a disabled preference. The strings are server data (the
 * doc's title/body), mirrored here so demo mode produces what production would.
 */
const TEMPLATES: Record<
  NotificationType,
  { pref: keyof NotificationPrefs; title: string; body: (p: { name: string; place?: string; community?: string }) => string }
> = {
  memoryTagged: {
    pref: 'tags',
    title: 'Tagged in a memory',
    body: ({ name }) => `${name} tagged you in a memory.`,
  },
  transferRequest: {
    pref: 'transfers',
    title: 'Custodianship request',
    body: ({ name, place }) => `${name} wants you to become a custodian of ${place}.`,
  },
  transferAccepted: {
    pref: 'transfers',
    title: 'Custodianship accepted',
    body: ({ name, place }) => `${name} accepted custodianship of ${place}.`,
  },
  transferRejected: {
    pref: 'transfers',
    title: 'Custodianship declined',
    body: ({ name, place }) => `${name} declined custodianship of ${place}.`,
  },
  communityInvite: {
    pref: 'communityInvites',
    title: 'Community invitation',
    body: ({ name, community }) => `${name} invited you to join ${community}.`,
  },
};

export interface NotifyInput {
  to: string;
  type: NotificationType;
  actorId: string;
  params?: { place?: string; community?: string };
  data?: Record<string, string>;
  /** Deterministic id: a second notify with the same id is a no-op (as the server's create()). */
  id?: string;
}

/** Returns whether a notification was written. Callers notify listeners. */
export function emulateNotify(store: Store, input: NotifyInput): boolean {
  const template = TEMPLATES[input.type];
  if (input.to === input.actorId) return false;
  if (store.isBlocked(input.to, input.actorId)) return false;
  if (store.users.get(input.to)?.notificationPrefs[template.pref] === false) return false;
  const inbox = store.notifications.get(input.to) ?? new Map();
  const id = input.id ?? store.nextNotificationId();
  if (inbox.has(id)) return false;
  const name = store.profiles.get(input.actorId)?.displayName ?? SOMEONE;
  inbox.set(id, {
    id,
    type: input.type,
    title: template.title,
    body: template.body({ ...input.params, name }),
    data: { ...input.data },
    createdAt: store.now(),
    readAt: null,
  });
  store.notifications.set(input.to, inbox);
  return true;
}

/**
 * functions/tags.js onMemoryCreatedTags: on create only, notify the first MAX_TAGS unique tagged
 * users who have a users doc, and only for memories they can read now (live, not hidden, public
 * or tagged), so a notification never leaks a memory its recipient cannot open.
 */
export function emulateTagNotifications(store: Store, memory: Memory): void {
  const readable =
    !memory.isDeleted &&
    memory.moderation !== 'hidden' &&
    (memory.privacy === 'public' || memory.privacy === 'tagged');
  if (!readable) return;
  let sent = false;
  for (const to of [...new Set(memory.taggedUserIds)].slice(0, MAX_TAGS)) {
    if (to === memory.userId || !store.users.has(to)) continue;
    sent =
      emulateNotify(store, {
        to,
        type: 'memoryTagged',
        actorId: memory.userId,
        data: { memoryId: memory.id, placeId: memory.placeId },
        id: `memoryTagged_${memory.id}_${to}`,
      }) || sent;
  }
  if (sent) store.notify(store.notificationListeners);
}
