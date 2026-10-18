import type { Repositories, Unsubscribe } from '@/data/types';

/** What tests may change on an account, as the Auth emulator's admin REST API would. */
export interface AccountPatch {
  email?: string;
  emailVerified?: boolean;
  /** The `staff` custom claim (functions/institutions.js createInstitution). */
  staff?: boolean;
}

export type ContractFactory = () => Promise<{
  repos: Repositories;
  signInAs(uid: string): Promise<void>;
  /**
   * Changes an existing account (the uid must have signed in once) and refreshes its token when
   * it is the signed-in user, so the next callable sees the new claims.
   */
  setAccount(uid: string, patch: AccountPatch): Promise<void>;
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

/**
 * Subscribes, waits until the latest emitted value satisfies `until` (an assertion), then
 * unsubscribes and returns that value.
 */
export async function observe<T>(
  subscribe: (cb: (value: T) => void) => Unsubscribe,
  until: (value: T) => void,
): Promise<T> {
  let latest = null as { value: T } | null;
  const unsub = subscribe((value) => { latest = { value }; });
  try {
    await waitFor(() => {
      if (latest === null) throw new Error('Nothing emitted yet');
      until(latest.value);
    });
    return (latest as unknown as { value: T }).value;
  } finally {
    unsub();
  }
}
