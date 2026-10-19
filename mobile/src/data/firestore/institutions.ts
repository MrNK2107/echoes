import { reload, type Auth } from 'firebase/auth';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, type Firestore } from 'firebase/firestore';
import { CLAIM_ADMIN_ERRORS } from '../callableErrors';
import { institutionFromDoc } from '../mappers';
import type { InstitutionRepository } from '../types';
import { callCallable, type CallableClient } from './callables';
import { subscribeUnion } from './snapshots';

const LIST_LIMIT = 50;

/**
 * Institutions are readable by every signed-in user and written only by the callables in
 * functions/institutions.js (ADR-0007).
 */
export function createInstitutionRepository(
  db: Firestore,
  auth: Auth,
  callables: CallableClient,
): InstitutionRepository {
  const institutions = collection(db, 'institutions');
  /**
   * createInstitution and claimInstitutionAdmin judge the ID token's claims (`staff`,
   * `email_verified`, `email`). A cached token predates a just-verified email or a new staff
   * claim, so force a fresh token first (minted from the refresh token, so it works even when the
   * cached ID token was invalidated by an account change), then reload the local user. A failure
   * here (e.g. offline) is left to the callable, which reports it with the right copy.
   */
  const refreshClaims = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await user.getIdToken(true);
      await reload(user);
    } catch {
      // The callable below fails with the mapped error if the server can't be reached.
    }
  };
  return {
    subscribeAll(cb, onError) {
      const q = query(institutions, orderBy('name'), limit(LIST_LIMIT));
      return subscribeUnion(
        [q],
        (docs) =>
          cb(
            docs
              .map((d) => institutionFromDoc(d.id, d.data()))
              .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1)),
          ),
        onError,
      );
    },
    async findById(id) {
      const snap = await getDoc(doc(institutions, id));
      const data = snap.data();
      return data === undefined ? null : institutionFromDoc(snap.id, data);
    },
    subscribeIsAdmin(institutionId, uid, cb, onError) {
      return onSnapshot(
        doc(institutions, institutionId, 'admins', uid),
        (snap) => cb(snap.exists()),
        (e) => onError?.(e),
      );
    },
    async create({ name, allowedEmailDomains }) {
      await refreshClaims();
      const { id } = await callCallable<{ id: string }>(callables, 'createInstitution', {
        name,
        allowedEmailDomains,
      });
      return id;
    },
    async claimAdmin(id) {
      await refreshClaims();
      await callCallable(callables, 'claimInstitutionAdmin', { institutionId: id }, CLAIM_ADMIN_ERRORS);
    },
    async addSubZone(id, { name, latitude, longitude }) {
      await callCallable(callables, 'addInstitutionSubZone', { institutionId: id, name, latitude, longitude });
    },
  };
}
