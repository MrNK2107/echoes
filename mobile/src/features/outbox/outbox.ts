import type { FileStore, KeyValueStore } from '@/device/types';
import type { LatLng, PrivacyType } from '@/domain/types';

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
}

export function outboxKey(userId: string): string {
  return `outbox:${userId}`;
}

/** Persisted, per-user queue of drafts. Writes are serialized so concurrent add/remove never lose an entry. */
export class Outbox {
  private readonly key: string;
  private readonly listeners = new Set<(n: number) => void>();
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
    const count = await this.serial(async () => {
      const all = (await this.list()).filter((x) => x.memoryId !== d.memoryId);
      all.push(stored);
      await this.store.set(this.key, JSON.stringify(all));
      return all.length;
    });
    this.emit(count);
  }

  /** Drops the draft and deletes its persisted media files. A missing draft is a no-op. */
  async remove(memoryId: string): Promise<void> {
    const removed = await this.serial(async () => {
      const all = await this.list();
      const gone = all.find((x) => x.memoryId === memoryId);
      if (!gone) return null;
      const rest = all.filter((x) => x.memoryId !== memoryId);
      if (rest.length > 0) await this.store.set(this.key, JSON.stringify(rest));
      else await this.store.remove(this.key);
      return { gone, count: rest.length };
    });
    if (!removed) return;
    this.emit(removed.count);
    const uris = [removed.gone.imageUri, removed.gone.audioUri].filter((u): u is string => u !== null);
    await Promise.all(uris.map((u) => this.files.remove(u)));
  }

  /** Calls `cb` with the current count, then after every change. */
  subscribe(cb: (n: number) => void): () => void {
    this.listeners.add(cb);
    const seen = this.version;
    void this.list().then(
      (drafts) => {
        if (this.listeners.has(cb) && this.version === seen) cb(drafts.length);
      },
      () => {},
    );
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(count: number) {
    this.version++;
    this.listeners.forEach((cb) => cb(count));
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn);
    this.tail = run.catch(() => {});
    return run;
  }
}
