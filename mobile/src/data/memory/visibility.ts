import { isMemoryVisibleTo } from '@/domain/privacy';
import type { Memory } from '@/domain/types';
import type { Store } from './store';

/** What the rules let `viewerId` read: visible memories, plus the author's own (even deleted). */
export function canRead(store: Store, m: Memory, viewerId: string): boolean {
  if (viewerId === m.userId) return true;
  const communityIds = store.users.get(viewerId)?.communityIds ?? [];
  const member = m.communityId !== null && communityIds.includes(m.communityId);
  return isMemoryVisibleTo(m, { viewerId, viewerIsCommunityMember: member, now: store.now() });
}
