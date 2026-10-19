import type { Institution } from '@/domain/types';
import { callableFailure, CLAIM_ADMIN_ERRORS } from '../callableErrors';
import type { InstitutionRepository } from '../types';
import { addMember, linkUser, newCommunity, SYSTEM_OWNER } from './autoCommunities';
import { callerId, runCallable, validId, validNumber, validString } from './callable';
import type { Store } from './store';

const LIST_LIMIT = 50;
const MAX_DOMAINS = 10;
const MAX_SUB_ZONES = 100;
const DEFAULT_RADIUS_METERS = 60;
// functions/institutions.js HOSTNAME: lowercase labels of [a-z0-9-], at least two, TLD not all digits.
const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOSTNAME = new RegExp(`^(?=.{1,253}$)(?:${LABEL}\\.)+(?=[a-z0-9-]*[a-z])${LABEL}$`);

function normalizeDomains(domains: unknown): string[] {
  if (!Array.isArray(domains) || domains.length < 1 || domains.length > MAX_DOMAINS) {
    throw callableFailure('invalid-argument');
  }
  const out: string[] = [];
  for (const raw of domains) {
    if (typeof raw !== 'string') throw callableFailure('invalid-argument');
    const domain = raw.trim().toLowerCase();
    if (!HOSTNAME.test(domain)) throw callableFailure('invalid-argument');
    if (!out.includes(domain)) out.push(domain);
  }
  return out;
}

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  return at > 0 ? email.slice(at + 1).trim().toLowerCase() : null;
}

/**
 * In-process emulation of functions/institutions.js. The account's `staff` and `emailVerified`
 * flags stand in for the ID token claims.
 */
export function createInstitutionRepository(store: Store): InstitutionRepository {
  const changed = () => {
    store.notify(store.institutionListeners);
    store.notify(store.communityListeners);
  };
  return {
    subscribeAll(cb) {
      const emit = () =>
        cb(
          [...store.institutions.values()]
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1))
            .slice(0, LIST_LIMIT),
        );
      store.institutionListeners.add(emit);
      emit();
      return () => { store.institutionListeners.delete(emit); };
    },
    async findById(id) {
      return store.institutions.get(id) ?? null;
    },
    subscribeIsAdmin(id, uid, cb) {
      const emit = () => cb(store.institutionAdmins.get(id)?.has(uid) === true);
      store.institutionListeners.add(emit);
      emit();
      return () => { store.institutionListeners.delete(emit); };
    },
    create(input) {
      return runCallable(() => {
        const uid = callerId(store);
        const name = validString(input.name, 1, 100, true);
        const raw = input.allowedEmailDomains;
        if (!Array.isArray(raw) || raw.some((d) => typeof d !== 'string')) throw callableFailure('invalid-argument');
        if (store.accountOf(uid)?.staff !== true) throw callableFailure('permission-denied');
        const allowedEmailDomains = normalizeDomains(raw);
        const id = store.nextId('institution');
        const communityId = `inst-${id}`;
        const institution: Institution = { id, name, allowedEmailDomains, subZones: [], communityId };
        store.institutions.set(id, institution);
        store.communities.set(
          communityId,
          newCommunity(
            {
              id: communityId, name, description: `Memories shared at ${name}.`, type: 'institution',
              ownerId: SYSTEM_OWNER, institutionId: id, memberCount: 0,
            },
            store.now(),
          ),
        );
        changed();
        return id;
      });
    },
    claimAdmin(id) {
      return runCallable(() => {
        const uid = callerId(store);
        validId(id);
        const account = store.accountOf(uid);
        if (account?.emailVerified !== true) throw callableFailure('failed-precondition');
        const institution = store.institutions.get(id);
        if (!institution) throw callableFailure('not-found');
        // Exact match only: a subdomain of an allowed domain is not allowed.
        const domain = emailDomain(account.email);
        if (!domain || !institution.allowedEmailDomains.some((d) => d.toLowerCase() === domain)) {
          throw callableFailure('permission-denied');
        }
        const admins = store.institutionAdmins.get(id) ?? new Set<string>();
        admins.add(uid);
        store.institutionAdmins.set(id, admins);
        const communityId = institution.communityId ?? `inst-${id}`;
        if (store.communities.has(communityId)) {
          const existing = store.members.get(communityId)?.get(uid);
          if (!existing) addMember(store, communityId, uid, 'guardian');
          else if (existing.role !== 'guardian') store.membersOf(communityId).set(uid, { ...existing, role: 'guardian' });
          linkUser(store, uid, communityId, true);
        }
        changed();
      }, CLAIM_ADMIN_ERRORS);
    },
    addSubZone(id, input) {
      return runCallable(() => {
        const uid = callerId(store);
        validId(id);
        const name = validString(input.name, 1, 60, true);
        const latitude = validNumber(input.latitude, -90, 90);
        const longitude = validNumber(input.longitude, -180, 180);
        const institution = store.institutions.get(id);
        if (!institution) throw callableFailure('not-found');
        if (store.institutionAdmins.get(id)?.has(uid) !== true) throw callableFailure('permission-denied');
        if (institution.subZones.length >= MAX_SUB_ZONES) throw callableFailure('failed-precondition');
        const zone = { id: store.nextId('zone'), name, latitude, longitude, radiusMeters: DEFAULT_RADIUS_METERS };
        store.institutions.set(id, { ...institution, subZones: [...institution.subZones, zone] });
        changed();
      });
    },
  };
}
