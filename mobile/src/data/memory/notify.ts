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
    actorId: input.actorId,
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
  if (tagNotificationsForMemory(store, memory)) store.notify(store.notificationListeners);
}

const RELEASE_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * functions/tags.js taggedUsersCanRead: a memory notifies when live, not hidden, and public or
 * tagged, or time-release once its releaseDate has passed.
 */
function canNotify(memory: Memory, now: Date): boolean {
  if (memory.isDeleted || memory.moderation === 'hidden') return false;
  if (memory.privacy === 'public' || memory.privacy === 'tagged') return true;
  return memory.privacy === 'timeRelease' && memory.releaseDate !== null && memory.releaseDate <= now;
}

/**
 * functions/tags.js notifyReleasedTags: time-release memories whose releaseDate fell in
 * (now - 2 h, now] notify their tagged users (deterministic ids make repeats a no-op). Demo mode
 * has no scheduler, so the inbox runs this on every emit, with the store's clock. Does not notify
 * listeners (it runs inside one); returns whether anything was written.
 */
export function emulateReleasedTagNotifications(store: Store): boolean {
  const now = store.now();
  let sent = false;
  for (const memory of store.memories.values()) {
    if (memory.privacy !== 'timeRelease' || memory.releaseDate === null) continue;
    const at = memory.releaseDate.getTime();
    if (at <= now.getTime() - RELEASE_WINDOW_MS || at > now.getTime()) continue;
    sent = tagNotificationsForMemory(store, memory) || sent;
  }
  return sent;
}

function tagNotificationsForMemory(store: Store, memory: Memory): boolean {
  if (!canNotify(memory, store.now())) return false;
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
  return sent;
}
