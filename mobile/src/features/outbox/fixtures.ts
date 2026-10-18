import { SEED_CENTER } from '@/device/fakes';

import type { OutboxDraft } from './outbox';

/** Test fixture: a queued draft at the seed centre. */
export function outboxDraft(o: Partial<OutboxDraft> = {}): OutboxDraft {
  return {
    memoryId: 'm1',
    placeIdIfNew: 'p_m1',
    userId: 'user-demo',
    createdAt: '2026-10-18T09:00:00.000Z',
    textContent: 'Queued memory',
    privacy: 'public',
    releaseDate: null,
    taggedUserIds: [],
    communityId: null,
    location: SEED_CENTER,
    imageUri: null,
    audioUri: null,
    ...o,
  };
}
