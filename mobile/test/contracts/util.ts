import type { Repositories } from '@/data/types';

export type ContractFactory = () => Promise<{
  repos: Repositories;
  signInAs(uid: string): Promise<void>;
  cleanup(): Promise<void>;
}>;

/** Polls `fn` until it stops throwing or the timeout elapses (default 10 s). */
export async function waitFor(
  fn: () => void | Promise<void>,
  timeoutMs = 10_000,
  intervalMs = 50,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      await fn();
      return;
    } catch (e) {
      if (Date.now() - start > timeoutMs) throw e;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}
