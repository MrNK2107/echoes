import { isMemoryVisibleTo } from '@/domain/privacy';
import type { Community, Memory } from '@/domain/types';
import { callableFailure, COMMUNITY_LEAVE_ERRORS } from '../callableErrors';
import type { CommunityRepository } from '../types';
import { addMember, linkUser, newCommunity } from './autoCommunities';
import { callerId, rateLimit, runCallable, validId, validString } from './callable';
import { emulateNotify } from './notify';
import type { Store } from './store';

const LIST_LIMIT = 50;
const MAX_INVITES = 20;

const byName = (a: Community, b: Community) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1;

/** In-process emulation of functions/communities.js (ADR-0007): the store is the server. */
export function createCommunityRepository(store: Store): CommunityRepository {
  const changed = () => store.notify(store.communityListeners);
  const listen = (emit: () => void, ...sets: Set<() => void>[]) => {
    for (const s of sets) s.add(emit);
    emit();
    return () => {
      for (const s of sets) s.delete(emit);
    };
  };

  return {
    subscribeMine(uid, cb) {
      return listen(() => {
        const ids = store.users.get(uid)?.communityIds ?? [];
        cb(
          ids
            .map((id) => store.communities.get(id))
            .filter((c): c is Community => c !== undefined)
            .sort(byName),
        );
      }, store.communityListeners);
    },
    subscribeDiscover(cb) {
      // Firestore breaks memberCount ties by document id in the same (descending) direction.
      return listen(
        () =>
          cb(
            [...store.communities.values()]
              .sort((a, b) => b.memberCount - a.memberCount || (a.id < b.id ? 1 : -1))
              .slice(0, LIST_LIMIT),
          ),
        store.communityListeners,
      );
    },
    async findById(id) {
      return store.communities.get(id) ?? null;
    },
    subscribeMembership(id, uid, cb) {
      return listen(() => cb(store.members.get(id)?.get(uid) ?? null), store.communityListeners);
    },
    subscribeFeed(id, viewer, cb) {
      return listen(() => {
        // Firestore runs the member branch only for a claimed membership, and the rules then
        // check the members doc; the own branch needs neither.
        const member = viewer.viewerCommunityIds.includes(id) && store.isMember(id, viewer.viewerId);
        const visibleToMember = (m: Memory) =>
          member &&
          m.privacy === 'community' &&
          isMemoryVisibleTo(m, { viewerId: viewer.viewerId, viewerIsCommunityMember: true, now: viewer.now });
        cb(
          [...store.memories.values()]
            .filter((m) => m.communityId === id && !m.isDeleted)
            .filter((m) => m.userId === viewer.viewerId || visibleToMember(m))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, LIST_LIMIT),
        );
      }, store.memoryListeners, store.communityListeners);
    },
    create(input) {
      return runCallable(() => {
        const uid = callerId(store);
        const name = validString(input.name, 1, 60, true);
        const description = validString(input.description, 1, 500, true);
        rateLimit(store, uid, 'createCommunity', 10);
        const id = store.nextId('community');
        store.communities.set(
          id,
          newCommunity({ id, name, description, type: 'thematic', ownerId: uid, memberCount: 0 }, store.now()),
        );
        addMember(store, id, uid, 'owner');
        linkUser(store, uid, id, true);
        changed();
        return id;
      });
    },
    join(id) {
      return runCallable(() => {
        const uid = callerId(store);
        validId(id);
        const community = store.communities.get(id);
        if (!community) throw callableFailure('not-found');
        addMember(store, id, uid, community.ownerId === uid ? 'owner' : 'member');
        linkUser(store, uid, id, true);
        changed();
      });
    },
    leave(id) {
      return runCallable(() => {
        const uid = callerId(store);
        validId(id);
        const community = store.communities.get(id);
        const existing = store.members.get(id)?.get(uid);
        if (community?.ownerId === uid || existing?.role === 'owner') {
          throw callableFailure('failed-precondition');
        }
        if (existing) {
          store.members.get(id)?.delete(uid);
          if (community) store.communities.set(id, { ...community, memberCount: community.memberCount - 1 });
        }
        linkUser(store, uid, id, false);
        changed();
      }, COMMUNITY_LEAVE_ERRORS);
    },
    invite(id, userIds) {
      return runCallable(() => {
        const uid = callerId(store);
        validId(id);
        if (!Array.isArray(userIds) || userIds.length < 1 || userIds.length > MAX_INVITES) {
          throw callableFailure('invalid-argument');
        }
        userIds.forEach(validId);
        // R27: the budget counts unique invitees, not calls.
        const unique = [...new Set(userIds)];
        rateLimit(store, uid, 'inviteToCommunity', 200, unique.length);
        const community = store.communities.get(id);
        if (!community) throw callableFailure('not-found');
        if (!store.isMember(id, uid)) throw callableFailure('permission-denied');
        let sent = false;
        for (const to of unique) {
          if (to === uid || !store.users.has(to) || store.isMember(id, to)) continue;
          // emulateNotify skips blocked pairs and disabled prefs silently, as the server does.
          sent =
            emulateNotify(store, {
              to, type: 'communityInvite', actorId: uid, params: { community: community.name },
              data: { communityId: id },
            }) || sent;
        }
        if (sent) store.notify(store.notificationListeners);
      });
    },
  };
}
