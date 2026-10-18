import { normalizeName } from '@/domain/communities';
import { validateDisplayName } from '@/domain/profiles';
import type { AppNotification, AppUser, AuthSession, Memory, Place, ReportReason } from '@/domain/types';

export interface Account { userId: string; email: string; password: string; displayName: string | null }

export interface MemorySeed {
  places: Place[];
  memories: Memory[];
  users: AppUser[];
  credentials?: Account[];
}

export interface MemoryBackendOptions {
  /** Injectable clock used for aggregate recomputation. Default `() => new Date()`. */
  now?: () => Date;
}

/** publicProfiles/{uid} as stored (displayNameLower is the search key). */
export interface StoredProfile { displayName: string; displayNameLower: string; updatedAt: Date }

/** reports/{memoryId}_{reporterId} (functions/safety.js). */
export interface StoredReport {
  memoryId: string;
  reporterId: string;
  reason: ReportReason;
  note: string | null;
  createdAt: Date;
}

export class Store {
  readonly places = new Map<string, Place>();
  readonly memories = new Map<string, Memory>();
  readonly users = new Map<string, AppUser>();
  readonly accounts = new Map<string, Account>(); // keyed by lowercased email
  readonly profiles = new Map<string, StoredProfile>();
  /** users/{uid}/notifications, keyed by uid then notification id. */
  readonly notifications = new Map<string, Map<string, AppNotification>>();
  /** users/{uid}/blocks, keyed by uid then blocked uid, valued by createdAt. */
  readonly blocks = new Map<string, Map<string, Date>>();
  readonly reports = new Map<string, StoredReport>();
  /** rateLimits/{uid}_{action}_{yyyymmdd} counters. */
  readonly rateLimits = new Map<string, number>();
  session: AuthSession | null = null;
  readonly placeListeners = new Set<() => void>();
  readonly memoryListeners = new Set<() => void>();
  readonly authListeners = new Set<() => void>();
  readonly notificationListeners = new Set<() => void>();
  readonly blockListeners = new Set<() => void>();
  private notificationSeq = 0;
  private userSeq = 0;
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
    for (const c of seed?.credentials ?? []) this.accounts.set(c.email.toLowerCase(), c);
  }

  nextUserId(): string {
    this.userSeq += 1;
    return `mem-user-${this.userSeq}`;
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
