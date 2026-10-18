import {
  describeError,
  isNetworkError,
  isPermanentError,
  runDraft,
  TimeoutError,
  withTimeout,
} from '@/features/memories/submitMemory';
import type { Services } from '@/services/services';

import type { Outbox } from './outbox';

/** Retry delays after consecutive failed passes (ADR-0006); the last value is the cap. */
export const BACKOFF_SECONDS = [2, 4, 8, 16, 32, 64] as const;

/**
 * Replays outbox drafts on start, when connectivity comes back, when a draft is queued, and on retryNow.
 * A pass that leaves any retryable draft behind schedules the next one with exponential backoff; any
 * success or retryNow resets it. Drafts that hit a permanent error are parked (ruling R14) and skipped
 * until retryNow; drafts whose original submit is still running are skipped until it settles.
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
    const offQueue = this.outbox.onAdded(() => {
      // Queued during a pass: run once more right after it. Otherwise take the next backoff slot.
      if (this.running) this.again = true;
      else if (this.timer === undefined) this.schedule();
    });
    void this.kick();
    return () => {
      this.stopped = true;
      off();
      offQueue();
      this.clearTimer();
    };
  }

  /** Resets the backoff and gives parked drafts one more attempt. */
  async retryNow(): Promise<void> {
    this.attempt = 0;
    this.clearTimer();
    await this.outbox.resetFailed();
    await this.kick();
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
      const drafts = (await this.outbox.list()).filter((d) => !d.failed);
      let succeeded = false;
      for (const d of drafts) {
        if (this.stopped) return;
        if (this.outbox.isInFlight(d.memoryId)) continue;
        try {
          await withTimeout(runDraft(this.services, d));
          await this.outbox.remove(d.memoryId);
          succeeded = true;
        } catch (e) {
          if (isPermanentError(e)) {
            const reason = describeError(e);
            console.warn('Outbox draft failed permanently', { memoryId: d.memoryId, failedReason: reason });
            await this.outbox.markFailed(d.memoryId, reason);
          } else if (!(e instanceof TimeoutError) && !isNetworkError(e)) {
            console.warn('Outbox replay failed', e);
          }
        }
      }
      if (succeeded) this.attempt = 0;
      // Anything still retryable (failed transiently, or skipped while in flight) gets the next backoff slot.
      const remaining = (await this.outbox.list()).filter((d) => !d.failed);
      if (remaining.length > 0) this.schedule();
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
