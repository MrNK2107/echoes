import {
  EMAIL_DOMAIN_NOT_APPROVED,
  GENERIC_ERROR,
  OWNER_CANNOT_LEAVE,
  REPORT_DUPLICATE,
  REPORT_RATE,
  TIMEOUT_ERROR,
  TRANSFER_DUPLICATE,
  VERIFY_EMAIL_FIRST,
} from './errors';

/** HttpsError codes (functions/lib/callable.js) without the SDK's `functions/` prefix. */
export type CallableCode =
  | 'invalid-argument'
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'already-exists'
  | 'failed-precondition'
  | 'resource-exhausted'
  | 'unavailable'
  | 'deadline-exceeded'
  | 'internal';

/** Per call site copy for the codes that have their own message in the spec. */
export type CallableErrorCopy = Partial<Record<CallableCode, string>>;

export const REPORT_ERRORS: CallableErrorCopy = {
  'already-exists': REPORT_DUPLICATE,
  'resource-exhausted': REPORT_RATE,
};

/** leaveCommunity refuses the owner with failed-precondition. */
export const COMMUNITY_LEAVE_ERRORS: CallableErrorCopy = { 'failed-precondition': OWNER_CANNOT_LEAVE };

/** initiateTransfer: already-exists means a request to that person is pending. */
export const TRANSFER_INITIATE_ERRORS: CallableErrorCopy = { 'already-exists': TRANSFER_DUPLICATE };

/** claimInstitutionAdmin: unverified email, then a domain that is not exactly an allowed one. */
export const CLAIM_ADMIN_ERRORS: CallableErrorCopy = {
  'failed-precondition': VERIFY_EMAIL_FIRST,
  'permission-denied': EMAIL_DOMAIN_NOT_APPROVED,
};

const OFFLINE_CODES = new Set(['unavailable', 'deadline-exceeded']);

/**
 * What the in-memory backend throws when it emulates a callable refusing a request, shaped like
 * the Firebase SDK's FunctionsError so both backends go through mapCallableError.
 */
export function callableFailure(code: CallableCode): Error & { code: string } {
  return Object.assign(new Error(code), { code: `functions/${code}` });
}

/**
 * Maps a callable failure to user-facing copy: the call site's copy for its listed codes, the
 * timeout copy when the server could not be reached, otherwise generic copy. The server's raw
 * message never reaches the UI.
 */
export function mapCallableError(e: unknown, copy: CallableErrorCopy = {}): Error {
  const raw = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  const code = typeof raw === 'string' ? raw.replace(/^functions\//, '') : null;
  if (code !== null) {
    const listed = copy[code as CallableCode];
    if (listed !== undefined) return new Error(listed);
    if (OFFLINE_CODES.has(code)) return new Error(TIMEOUT_ERROR);
  }
  return new Error(GENERIC_ERROR);
}
