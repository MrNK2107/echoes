import {
  collection,
  doc,
  documentId,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import type { Community } from '@/domain/types';
import { COMMUNITY_LEAVE_ERRORS } from '../callableErrors';
import { communityFromDoc, membershipFromDoc, memoryFromDoc } from '../mappers';
import type { CommunityRepository, Unsubscribe } from '../types';
import { callCallable, type CallableClient } from './callables';
import { subscribeUnion } from './snapshots';

const LIST_LIMIT = 50;
/** documentId() `in` takes at most 30 values per query. */
const ID_IN_CHUNK = 30;

const byName = (a: Community, b: Community) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1;

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/**
 * Reads are direct (the rules let signed-in users read communities, and a member doc its own
 * user); every change goes through the callables in functions/communities.js (ADR-0007).
 */
export function createCommunityRepository(db: Firestore, callables: CallableClient): CommunityRepository {
  const communities = collection(db, 'communities');
  const memories = collection(db, 'memories');
  return {
    subscribeMine(uid, cb, onError) {
      // users/{uid}.communityIds is the membership index the server keeps (linkUser); the
      // members collection group is not readable by clients. Each change of the id list
      // re-subscribes to the communities themselves.
      let inner: Unsubscribe = () => {};
      let key: string | null = null;
      const outer = onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          const raw: unknown = snap.data()?.communityIds;
          const ids = [...new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [])];
          const next = JSON.stringify(ids);
          if (next === key) return;
          key = next;
          inner();
          inner = subscribeUnion(
            chunk(ids, ID_IN_CHUNK).map((c) => query(communities, where(documentId(), 'in', c))),
            (docs) => cb(docs.map((d) => communityFromDoc(d.id, d.data())).sort(byName)),
            onError,
          );
        },
        (e) => onError?.(e),
      );
      return () => {
        outer();
        inner();
      };
    },
    subscribeDiscover(cb, onError) {
      const q = query(communities, orderBy('memberCount', 'desc'), limit(LIST_LIMIT));
      return subscribeUnion(
        [q],
        (docs) =>
          cb(
            docs
              .map((d) => communityFromDoc(d.id, d.data()))
              .sort((a, b) => b.memberCount - a.memberCount || (a.id < b.id ? 1 : -1)),
          ),
        onError,
      );
    },
    async findById(id) {
      const snap = await getDoc(doc(communities, id));
      const data = snap.data();
      return data === undefined ? null : communityFromDoc(snap.id, data);
    },
    subscribeMembership(id, uid, cb, onError) {
      return onSnapshot(
        doc(communities, id, 'members', uid),
        (snap) => {
          const data = snap.data();
          cb(data === undefined ? null : membershipFromDoc(data));
        },
        (e) => onError?.(e),
      );
    },
    subscribeFeed(id, viewer, cb, onError) {
      // Each branch carries what the rules need to prove every result readable: the own branch
      // `userId ==`; the member branch `communityId ==` (isCommunityMember on that id),
      // `privacy == 'community'` and `moderation == null`. Non-members skip the member branch,
      // which the rules would deny.
      const feed = (...constraints: QueryConstraint[]) =>
        query(
          memories,
          where('communityId', '==', id),
          where('isDeleted', '==', false),
          ...constraints,
          orderBy('createdAt', 'desc'),
          limit(LIST_LIMIT),
        );
      const queries = [feed(where('userId', '==', viewer.viewerId))];
      if (viewer.viewerCommunityIds.includes(id)) {
        queries.push(feed(where('privacy', '==', 'community'), where('moderation', '==', null)));
      }
      return subscribeUnion(
        queries,
        (docs) =>
          cb(
            docs
              .map((d) => memoryFromDoc(d.id, d.data()))
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(0, LIST_LIMIT),
          ),
        onError,
      );
    },
    async create({ name, description }) {
      const { id } = await callCallable<{ id: string }>(callables, 'createCommunity', { name, description });
      return id;
    },
    async join(id) {
      await callCallable(callables, 'joinCommunity', { communityId: id });
    },
    async leave(id) {
      await callCallable(callables, 'leaveCommunity', { communityId: id }, COMMUNITY_LEAVE_ERRORS);
    },
    async invite(id, userIds) {
      await callCallable(callables, 'inviteToCommunity', { communityId: id, userIds });
    },
  };
}
