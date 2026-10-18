import { callableFailure, mapCallableError, type CallableErrorCopy } from '../callableErrors';
import type { Store } from './store';

/**
 * In-process stand-in for functions/lib/callable.js: the handler runs synchronously against the
 * store, and any failure goes through the same mapCallableError as the Firestore backend.
 */
export async function runCallable<T>(handler: () => T, copy: CallableErrorCopy = {}): Promise<T> {
  try {
    return handler();
  } catch (e) {
    throw mapCallableError(e, copy);
  }
}

/** request.auth.uid, or unauthenticated. */
export function callerId(store: Store): string {
  const uid = store.session?.userId;
  if (!uid) throw callableFailure('unauthenticated');
  return uid;
}

/** The schema's string rule: optionally trimmed, `min`..`max` code points. */
export function validString(v: unknown, min: number, max: number, trim = false): string {
  if (typeof v !== 'string') throw callableFailure('invalid-argument');
  const s = trim ? v.trim() : v;
  const len = [...s].length;
  if (len < min || len > max) throw callableFailure('invalid-argument');
  return s;
}

/** idField: 1-128 characters, no slash, not "." or "..". */
export function validId(v: unknown): string {
  const s = validString(v, 1, 128);
  if (!/^(?!\.\.?$)[^/]{1,128}$/.test(s)) throw callableFailure('invalid-argument');
  return s;
}

export function validNumber(v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    throw callableFailure('invalid-argument');
  }
  return v;
}

/** Consumes the caller's daily budget before the handler runs, as the wrapper does. */
export function rateLimit(store: Store, uid: string, action: string, perDay: number, amount = 1): void {
  if (!store.consumeRateLimit(uid, action, perDay, amount)) throw callableFailure('resource-exhausted');
}
