import { normalizeName } from '@/domain/communities';
import { validateDisplayName } from '@/domain/profiles';
import type { PushTokenRecord } from '../types';
import type {
  AppNotification,
  AppUser,
  AuraHistoryEntry,
  AuthSession,
  Community,
  CommunityMembership,
  Institution,
  Memory,
  Place,
  ReportReason,
  Transfer,
} from '@/domain/types';

export interface Account {
  userId: string;
  email: string;
  password: string;
  displayName: string | null;
  /** The ID token's `email_verified`; default false. */
  emailVerified?: boolean;
  /** The `staff` custom claim (createInstitution); default false. */
  staff?: boolean;
}

export interface MemorySeed {
  places: Place[];
  memories: Memory[];
  users: AppUser[];
  credentials?: Account[];
  /**
   * Communities to start with. Every seed user's `communityIds` becomes a membership (owner when
   * the community's ownerId is theirs), and memberCount is recomputed from the memberships.
   */
  communities?: Community[];
}

export interface MemoryBackendOptions {
  /** Injectable clock used for aggregate recomputation. Default `() => new Date()`. */
  now?: () => Date;
}

/** publicProfiles/{uid} as stored (displayNameLower is the search key). */
export interface StoredProfile { displayName: string; displayNameLower: string; updatedAt: Date }

/**
 * reports/{memoryId}_{reporterId} (reportMemory) or reports/{targetType}_{targetId}_{reporterId}
 * (reportContent) in functions/safety.js.
 */
export interface StoredReport {
  memoryId?: string;
  targetType?: 'community' | 'profile';
  targetId?: string;
  reporterId: string;
  /** The reporter's ID token email_verified at report time; only verified reports hide. */
  reporterVerified: boolean;
  reason: ReportReason;
  note: string | null;
  createdAt: Date;
}

/** transfers/{id} as stored, with the server's bookkeeping fields. */
export interface StoredTransfer extends Transfer {
  recipientWasCustodian: boolean | null;
  revokedAt: Date | null;
}

export class Store {
  readonly places = new Map<string, Place>();
  readonly memories = new Map<string, Memory>();
  readonly users = new Map<string, AppUser>();
  readonly accounts = new Map<string, Account>(); // keyed by lowercased email
  readonly profiles = new Map<string, StoredProfile>();
  /** users/{uid}/pushTokens, keyed by uid then token. */
  readonly pushTokens = new Map<string, Map<string, PushTokenRecord>>();
  /** users/{uid}/notifications, keyed by uid then notification id. */
  readonly notifications = new Map<string, Map<string, AppNotification>>();
  /** users/{uid}/blocks, keyed by uid then blocked uid, valued by createdAt. */
  readonly blocks = new Map<string, Map<string, Date>>();
  readonly reports = new Map<string, StoredReport>();
  /** rateLimits/{uid}_{action}_{yyyymmdd} counters. */
  readonly rateLimits = new Map<string, number>();
  readonly communities = new Map<string, Community>();
  /** communities/{id}/members, keyed by community id then uid. */
  readonly members = new Map<string, Map<string, CommunityMembership>>();
  /** users/{uid}.leftCommunityIds (server-written, R26): kept beside the users doc. */
  readonly leftCommunityIds = new Map<string, Set<string>>();
  readonly transfers = new Map<string, StoredTransfer>();
  readonly institutions = new Map<string, Institution>();
  /** places/{id}/auraHistory in insertion (recordedAt) order. */
  readonly auraHistory = new Map<string, AuraHistoryEntry[]>();
  session: AuthSession | null = null;
  readonly placeListeners = new Set<() => void>();
  readonly memoryListeners = new Set<() => void>();
  readonly authListeners = new Set<() => void>();
  readonly notificationListeners = new Set<() => void>();
  readonly blockListeners = new Set<() => void>();
  /** Communities, memberships and users' communityIds. */
  readonly communityListeners = new Set<() => void>();
  readonly transferListeners = new Set<() => void>();
  readonly institutionListeners = new Set<() => void>();
  private notificationSeq = 0;
  private userSeq = 0;
  private docSeq = 0;
  readonly now: () => Date;

  constructor(seed?: MemorySeed, options?: MemoryBackendOptions) {
    this.now = options?.now ?? (() => new Date());
    for (const p of seed?.places ?? []) this.places.set(p.id, p);
    for (const m of seed?.memories ?? []) this.memories.set(m.id, m);
    for (const u of seed?.users ?? []) {
      this.users.set(u.id, u);
      // Seed users get the public profile registration would have written, so demo search works.
      if (u.displayName !== null && validateDisplayName(u.displayName) === null) {
        this.setProfile(u.id, u.displayName, u.createdAt);
      }
    }
    for (const c of seed?.credentials ?? []) this.accounts.set(c.email.toLowerCase(), { ...c });
    for (const c of seed?.communities ?? []) this.communities.set(c.id, { ...c, memberCount: 0 });
    for (const u of seed?.users ?? []) {
      for (const id of u.communityIds) {
        const community = this.communities.get(id);
        if (!community) continue;
        this.membersOf(id).set(u.id, { role: community.ownerId === u.id ? 'owner' : 'member', joinedAt: u.createdAt });
        this.communities.set(id, { ...community, memberCount: community.memberCount + 1 });
      }
    }
  }

  nextUserId(): string {
    this.userSeq += 1;
    return `mem-user-${this.userSeq}`;
  }

  /** Auto ids for server-created docs (`mem-<kind>-<n>`). */
  nextId(kind: string): string {
    this.docSeq += 1;
    return `mem-${kind}-${this.docSeq}`;
  }

  accountOf(uid: string): Account | null {
    for (const a of this.accounts.values()) if (a.userId === uid) return a;
    return null;
  }

  membersOf(communityId: string): Map<string, CommunityMembership> {
    let m = this.members.get(communityId);
    if (!m) {
      m = new Map();
      this.members.set(communityId, m);
    }
    return m;
  }

  isMember(communityId: string, uid: string): boolean {
    return this.members.get(communityId)?.has(uid) ?? false;
  }

  /**
   * functions/lib/rateLimit.js: consumes `amount` units of the (uid, action, UTC day) budget, or
   * returns false without consuming any when they would exceed `perDay`.
   */
  consumeRateLimit(uid: string, action: string, perDay: number, amount = 1): boolean {
    const key = `${uid}_${action}_${this.now().toISOString().slice(0, 10)}`;
    const used = this.rateLimits.get(key) ?? 0;
    if (used + amount > perDay) return false;
    this.rateLimits.set(key, used + amount);
    return true;
  }

  nextNotificationId(): string {
    this.notificationSeq += 1;
    return `mem-notification-${this.notificationSeq}`;
  }

  setProfile(uid: string, displayName: string, at: Date): void {
    const name = displayName.trim();
    this.profiles.set(uid, { displayName: name, displayNameLower: normalizeName(name), updatedAt: at });
  }

  /** functions/lib/blocks.js isBlocked: either user has blocked the other. */
  isBlocked(a: string, b: string): boolean {
    return (this.blocks.get(a)?.has(b) ?? false) || (this.blocks.get(b)?.has(a) ?? false);
  }

  notify(listeners: Set<() => void>): void {
    for (const l of [...listeners]) l();
  }
}
