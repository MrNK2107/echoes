import { httpsCallable, type Functions } from 'firebase/functions';
import { mapCallableError, type CallableErrorCopy } from '../callableErrors';

/**
 * The single way the Firestore backend invokes a callable (ADR-0007): every failure is mapped to
 * user-facing copy through mapCallableError, with `copy` for the call site's listed codes. Keep
 * all callable invocations here so timeouts and offline detection can be added in one place.
 */
export async function callCallable<Res = unknown>(
  functions: Functions,
  name: string,
  payload: Record<string, unknown>,
  copy: CallableErrorCopy = {},
): Promise<Res> {
  try {
    const result = await httpsCallable<Record<string, unknown>, Res>(functions, name)(payload);
    return result.data;
  } catch (e) {
    throw mapCallableError(e, copy);
  }
}
