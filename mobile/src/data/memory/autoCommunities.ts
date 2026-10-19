import { eraCommunity, GEO_THRESHOLD, geoCommunity, yearCommunity } from '@/domain/communities';
import type { Community, CommunityRole } from '@/domain/types';
import type { Store } from './store';

/** Auto communities have no user owner (R25). */
export const SYSTEM_OWNER = 'system';

export function newCommunity(
  fields: Omit<Community, 'createdAt' | 'updatedAt' | 'placeId' | 'institutionId'> &
    Partial<Pick<Community, 'placeId' | 'institutionId'>>,
  at: Date,
): Community {
  return { placeId: null, institutionId: null, ...fields, createdAt: at, updatedAt: at };
}

/**
 * functions/communities.js linkUser: joining adds the id to users/{uid}.communityIds and clears it
 * from leftCommunityIds; leaving does the reverse. A missing users doc is never recreated.
 */
export function linkUser(store: Store, uid: string, communityId: string, joined: boolean): void {
  const user = store.users.get(uid);
  if (!user) return;
  const ids = user.communityIds.filter((id) => id !== communityId);
  store.users.set(uid, { ...user, communityIds: joined ? [...ids, communityId] : ids });
  const left = store.leftCommunityIds.get(uid) ?? new Set<string>();
  if (joined) left.delete(communityId);
  else left.add(communityId);
  store.leftCommunityIds.set(uid, left);
}

/** Adds a membership and counts it; returns false when the user was already a member. */
export function addMember(store: Store, communityId: string, uid: string, role: CommunityRole): boolean {
  const community = store.communities.get(communityId);
  const members = store.membersOf(communityId);
  if (!community || members.has(uid)) return false;
  members.set(uid, { role, joinedAt: store.now() });
  store.communities.set(communityId, { ...community, memberCount: community.memberCount + 1 });
  return true;
}

function createIfMissing(store: Store, community: Community): void {
  if (!store.communities.has(community.id)) store.communities.set(community.id, community);
}

/**
 * onMemoryWritten ensureTimeCommunities: a created memory ensures `era-<d>s` and `time-<y>` and
 * joins its author to the year community, unless they left it before (R26).
 */
export function ensureTimeCommunities(store: Store, authorId: string, createdAt: Date): void {
  const at = store.now();
  const year = yearCommunity(createdAt);
  const era = eraCommunity(createdAt);
  const timeBased = { type: 'timeBased' as const, ownerId: SYSTEM_OWNER, memberCount: 0 };
  createIfMissing(
    store,
    newCommunity({ ...era, ...timeBased, description: `Memories from the ${era.id.slice(4)}.` }, at),
  );
  createIfMissing(
    store,
    newCommunity({ ...year, ...timeBased, description: `Memories from ${year.id.slice(5)}.` }, at),
  );
  if (store.isMember(year.id, authorId)) return;
  if (store.leftCommunityIds.get(authorId)?.has(year.id)) return;
  addMember(store, year.id, authorId, 'member');
  // Only the users doc's communityIds; leftCommunityIds is untouched (arrayUnion on communityIds).
  const user = store.users.get(authorId);
  if (user && !user.communityIds.includes(year.id)) {
    store.users.set(authorId, { ...user, communityIds: [...user.communityIds, year.id] });
  }
}

/**
 * onMemoryWritten ensureGeoCommunity: `geo-<placeId>` once the place has GEO_THRESHOLD public
 * memories, linked from place.communityId. Never rewrites an existing community.
 */
export function ensureGeoCommunity(store: Store, placeId: string): void {
  const place = store.places.get(placeId);
  if (!place || place.publicMemoryCount < GEO_THRESHOLD) return;
  const geo = geoCommunity({ id: placeId, name: place.name });
  createIfMissing(
    store,
    newCommunity(
      {
        ...geo, description: `Memories shared at ${place.name}.`, type: 'geographic',
        ownerId: SYSTEM_OWNER, placeId, memberCount: 0,
      },
      store.now(),
    ),
  );
  if (place.communityId !== geo.id) store.places.set(placeId, { ...place, communityId: geo.id });
}

/**
 * Account deletion (functions/communities.js cleanupUserCommunities and accountCleanup.js):
 * memberships are removed and counted down; an owned community passes to its earliest-joined
 * other member, or is deleted when nobody else is in it; institution admin roles are dropped.
 */
export function cleanupUserCommunities(store: Store, uid: string): void {
  for (const [id, members] of store.members) {
    const membership = members.get(uid);
    const community = store.communities.get(id);
    if (!membership) continue;
    members.delete(uid);
    if (!community) continue;
    if (community.ownerId !== uid) {
      store.communities.set(id, { ...community, memberCount: community.memberCount - 1 });
      continue;
    }
    const heir = [...members.entries()].sort(([, a], [, b]) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
    if (!heir) {
      store.communities.delete(id);
      store.members.delete(id);
      continue;
    }
    members.set(heir[0], { ...heir[1], role: 'owner' });
    store.communities.set(id, {
      ...community, ownerId: heir[0], memberCount: community.memberCount - 1, updatedAt: store.now(),
    });
  }
  for (const admins of store.institutionAdmins.values()) admins.delete(uid);
  store.notify(store.institutionListeners);
  store.leftCommunityIds.delete(uid);
}
