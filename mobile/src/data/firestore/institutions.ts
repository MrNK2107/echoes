import { collection, doc, getDoc, limit, orderBy, query, type Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import { CLAIM_ADMIN_ERRORS } from '../callableErrors';
import { institutionFromDoc } from '../mappers';
import type { InstitutionRepository } from '../types';
import { callCallable } from './callables';
import { subscribeUnion } from './snapshots';

const LIST_LIMIT = 50;

/**
 * Institutions are readable by every signed-in user and written only by the callables in
 * functions/institutions.js (ADR-0007).
 */
export function createInstitutionRepository(db: Firestore, functions: Functions): InstitutionRepository {
  const institutions = collection(db, 'institutions');
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
    async create({ name, allowedEmailDomains }) {
      const { id } = await callCallable<{ id: string }>(functions, 'createInstitution', {
        name,
        allowedEmailDomains,
      });
      return id;
    },
    async claimAdmin(id) {
      await callCallable(functions, 'claimInstitutionAdmin', { institutionId: id }, CLAIM_ADMIN_ERRORS);
    },
    async addSubZone(id, { name, latitude, longitude }) {
      await callCallable(functions, 'addInstitutionSubZone', { institutionId: id, name, latitude, longitude });
    },
  };
}
