import { httpsCallable, type Functions } from 'firebase/functions';
import { TIMEOUT_ERROR } from '../errors';
import { mapCallableError, type CallableErrorCopy } from '../callableErrors';

/**
 * The SDK default is 70 s; a callable that has not answered in 15 s is reported as a connection
 * problem instead of leaving the user waiting.
 */
export const CALLABLE_TIMEOUT_MS = 15_000;

/** What the Firestore backend needs to invoke callables. */
export interface CallableClient {
  functions: Functions;
  /** The device's connectivity (services.connectivity.isOnline). */
  isOnline(): Promise<boolean>;
}

async function deviceOnline(client: CallableClient): Promise<boolean> {
  try {
    return await client.isOnline();
  } catch {
    // An unknown network state must not turn a server error into a connection message.
    return true;
  }
}

/**
 * The single way the Firestore backend invokes a callable (ADR-0007). Every failure is mapped to
 * user-facing copy through mapCallableError, with `copy` for the call site's listed codes.
 * Offline, the SDK reports a failed fetch as `functions/internal` (HTTP status 0), so any code the
 * call site does not list becomes TIMEOUT_ERROR when the device is offline.
 */
export async function callCallable<Res = unknown>(
  client: CallableClient,
  name: string,
  payload: Record<string, unknown>,
  copy: CallableErrorCopy = {},
): Promise<Res> {
  try {
    const call = httpsCallable<Record<string, unknown>, Res>(client.functions, name, {
      timeout: CALLABLE_TIMEOUT_MS,
    });
    return (await call(payload)).data;
  } catch (e) {
    const mapped = mapCallableError(e, copy);
    const listed = Object.values(copy).includes(mapped.message);
    if (!listed && mapped.message !== TIMEOUT_ERROR && !(await deviceOnline(client))) {
      throw new Error(TIMEOUT_ERROR);
    }
    throw mapped;
  }
}
