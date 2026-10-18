import type { AppUser, AuthSession, Memory, Place } from '@/domain/types';

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

export class Store {
  readonly places = new Map<string, Place>();
  readonly memories = new Map<string, Memory>();
  readonly users = new Map<string, AppUser>();
  readonly accounts = new Map<string, Account>(); // keyed by lowercased email
  session: AuthSession | null = null;
  readonly placeListeners = new Set<() => void>();
  readonly memoryListeners = new Set<() => void>();
  readonly authListeners = new Set<() => void>();
  private userSeq = 0;
  readonly now: () => Date;

  constructor(seed?: MemorySeed, options?: MemoryBackendOptions) {
    this.now = options?.now ?? (() => new Date());
    for (const p of seed?.places ?? []) this.places.set(p.id, p);
    for (const m of seed?.memories ?? []) this.memories.set(m.id, m);
    for (const u of seed?.users ?? []) this.users.set(u.id, u);
    for (const c of seed?.credentials ?? []) this.accounts.set(c.email.toLowerCase(), c);
  }

  nextUserId(): string {
    this.userSeq += 1;
    return `mem-user-${this.userSeq}`;
  }

  notify(listeners: Set<() => void>): void {
    for (const l of [...listeners]) l();
  }
}
