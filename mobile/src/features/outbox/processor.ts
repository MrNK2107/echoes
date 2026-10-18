import { isNetworkError, runDraft, TimeoutError, withTimeout } from '@/features/memories/submitMemory';
import type { Services } from '@/services/services';

import type { Outbox } from './outbox';

/** Retry delays after consecutive failed passes (ADR-0006); the last value is the cap. */
export const BACKOFF_SECONDS = [2, 4, 8, 16, 32, 64] as const;

/**
 * Replays outbox drafts on start, when connectivity comes back, when a draft is queued, and on retryNow.
 * A pass that leaves any draft behind schedules the next one with exponential backoff; any success or
 * retryNow resets it.
 */
export class OutboxProcessor {
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private again = false;
  private stopped = true;

  constructor(
    private readonly services: Services,
    private readonly outbox: Outbox,
  ) {}

  /** Returns the stop function: unsubscribes from connectivity and clears the backoff timer. */
  start(): () => void {
    this.stopped = false;
    const off = this.services.connectivity.subscribe((online) => {
      if (online) void this.kick();
    });
    // A draft queued after a timed-out submit is retried on the normal backoff, not immediately.
    const offQueue = this.outbox.subscribe((pending) => {
      if (pending > 0 && this.timer === undefined && !this.running) this.schedule();
    });
    void this.kick();
    return () => {
      this.stopped = true;
      off();
      offQueue();
      this.clearTimer();
    };
  }

  retryNow(): Promise<void> {
    this.attempt = 0;
    this.clearTimer();
    return this.kick();
  }

  /** Single-flight: a kick during a pass runs one more pass afterwards. */
  private kick(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    const loop = async () => {
      do {
        this.again = false;
        await this.pass();
      } while (this.again && !this.stopped);
    };
    this.running = loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async pass(): Promise<void> {
    if (this.stopped) return;
    this.clearTimer();
    try {
      if (!(await this.services.connectivity.isOnline())) return;
      const drafts = await this.outbox.list();
      let succeeded = false;
      let failed = false;
      for (const d of drafts) {
        if (this.stopped) return;
        try {
          await withTimeout(runDraft(this.services, d));
          await this.outbox.remove(d.memoryId);
          succeeded = true;
        } catch (e) {
          failed = true;
          if (!(e instanceof TimeoutError) && !isNetworkError(e)) console.warn('Outbox replay failed', e);
        }
      }
      if (succeeded) this.attempt = 0;
      if (failed) this.schedule();
    } catch (e) {
      console.warn('Outbox pass failed', e);
      this.schedule();
    }
  }

  private schedule() {
    if (this.stopped) return;
    const seconds = BACKOFF_SECONDS[Math.min(this.attempt, BACKOFF_SECONDS.length - 1)]!;
    this.attempt++;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.kick();
    }, seconds * 1000);
  }

  private clearTimer() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
