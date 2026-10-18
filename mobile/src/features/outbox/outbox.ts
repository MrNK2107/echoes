import type { FileStore, KeyValueStore } from '@/device/types';
import type { LatLng, PrivacyType, SentimentResult } from '@/domain/types';

/** A memory saved while offline (ADR-0006). Plain JSON so it can be persisted as-is. */
export interface OutboxDraft {
  memoryId: string;
  placeIdIfNew: string;
  userId: string;
  /** ISO timestamp of the original save; replays keep it. */
  createdAt: string;
  textContent: string;
  privacy: PrivacyType;
  /** ISO timestamp or null. */
  releaseDate: string | null;
  taggedUserIds: string[];
  communityId: string | null;
  location: LatLng;
  imageUri: string | null;
  audioUri: string | null;
  /** Computed once at submit time so a replay writes identical data. Absent in drafts queued before it existed. */
  sentiment?: SentimentResult;
  /** Parked after a permanent error (ruling R14): not auto-retried; Retry gives it one more attempt. */
  failed?: boolean;
  failedReason?: string;
}

export interface OutboxCounts {
  /** Drafts waiting to upload. */
  pending: number;
  /** Drafts parked after a permanent error. */
  failed: number;
}

function countsOf(drafts: OutboxDraft[]): OutboxCounts {
  const failed = drafts.filter((d) => d.failed).length;
  return { pending: drafts.length - failed, failed };
}

export function outboxKey(userId: string): string {
  return `outbox:${userId}`;
}

/** Persisted, per-user queue of drafts. Writes are serialized so concurrent add/remove never lose an entry. */
export class Outbox {
  private readonly key: string;
  private readonly listeners = new Set<(c: OutboxCounts) => void>();
  private readonly inFlight = new Set<string>();
  private readonly addedListeners = new Set<() => void>();
  private tail: Promise<unknown> = Promise.resolve();
  private version = 0;

  constructor(
    private readonly store: KeyValueStore,
    private readonly files: FileStore,
    userId: string,
  ) {
    this.key = outboxKey(userId);
  }

  async list(): Promise<OutboxDraft[]> {
    const raw = await this.store.get(this.key);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OutboxDraft[]) : [];
    } catch {
      return [];
    }
  }

  /** Copies the draft's photo/voice files into the app's document directory, then stores the draft. */
  async add(d: OutboxDraft): Promise<void> {
    const imageUri = d.imageUri ? await this.files.persist(d.imageUri, `${d.memoryId}.jpg`) : null;
    const audioUri = d.audioUri ? await this.files.persist(d.audioUri, `${d.memoryId}.m4a`) : null;
    const stored: OutboxDraft = { ...d, imageUri, audioUri };
    const counts = await this.serial(async () => {
      const all = (await this.list()).filter((x) => x.memoryId !== d.memoryId);
      all.push(stored);
      await this.store.set(this.key, JSON.stringify(all));
      return countsOf(all);
    });
    this.emit(counts);
    this.addedListeners.forEach((cb) => cb());
  }

  /** Calls `cb` after each successful add. */
  onAdded(cb: () => void): () => void {
    this.addedListeners.add(cb);
    return () => {
      this.addedListeners.delete(cb);
    };
  }

  /** Drops the draft and deletes its persisted media files. A missing draft is a no-op. */
  async remove(memoryId: string): Promise<void> {
    await this.removeWhere((x) => x.memoryId === memoryId);
  }

  /** Removes every parked draft and its files (the user confirmed Discard). */
  async discardFailed(): Promise<void> {
    await this.removeWhere((x) => x.failed === true);
  }

  /** Removes every draft and its persisted files (account deletion). */
  async clear(): Promise<void> {
    await this.removeWhere(() => true);
  }

  /** Parks the draft after a permanent error so the processor stops retrying it. */
  async markFailed(memoryId: string, reason: string): Promise<void> {
    await this.update((all) =>
      all.map((x) => (x.memoryId === memoryId ? { ...x, failed: true, failedReason: reason } : x)),
    );
  }

  /** Un-parks every failed draft for one more attempt (manual Retry). */
  async resetFailed(): Promise<void> {
    await this.update((all) =>
      all.map((x) => {
        if (!x.failed) return x;
        const { failed: _failed, failedReason: _reason, ...rest } = x;
        return rest;
      }),
    );
  }

  /** In-memory marks for drafts whose original submit is still running; the processor skips them. */
  markInFlight(memoryId: string): void {
    this.inFlight.add(memoryId);
  }

  clearInFlight(memoryId: string): void {
    this.inFlight.delete(memoryId);
  }

  isInFlight(memoryId: string): boolean {
    return this.inFlight.has(memoryId);
  }

  /** Calls `cb` with the current counts, then after every change. */
  subscribe(cb: (c: OutboxCounts) => void): () => void {
    this.listeners.add(cb);
    const seen = this.version;
    void this.list().then(
      (drafts) => {
        if (this.listeners.has(cb) && this.version === seen) cb(countsOf(drafts));
      },
      () => {},
    );
    return () => {
      this.listeners.delete(cb);
    };
  }

  private async write(all: OutboxDraft[]): Promise<void> {
    if (all.length > 0) await this.store.set(this.key, JSON.stringify(all));
    else await this.store.remove(this.key);
  }

  private async update(fn: (all: OutboxDraft[]) => OutboxDraft[]): Promise<void> {
    const counts = await this.serial(async () => {
      const next = fn(await this.list());
      await this.write(next);
      return countsOf(next);
    });
    this.emit(counts);
  }

  private async removeWhere(match: (d: OutboxDraft) => boolean): Promise<void> {
    const result = await this.serial(async () => {
      const all = await this.list();
      const gone = all.filter(match);
      if (gone.length === 0) return null;
      const rest = all.filter((x) => !match(x));
      await this.write(rest);
      return { gone, counts: countsOf(rest) };
    });
    if (!result) return;
    this.emit(result.counts);
    const uris = result.gone.flatMap((d) => [d.imageUri, d.audioUri]).filter((u): u is string => u !== null);
    await Promise.all(uris.map((u) => this.files.remove(u)));
  }

  private emit(counts: OutboxCounts) {
    this.version++;
    this.listeners.forEach((cb) => cb(counts));
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn);
    this.tail = run.catch(() => {});
    return run;
  }
}
