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
import {
  callableFailure,
  CLAIM_ADMIN_ERRORS,
  COMMUNITY_LEAVE_ERRORS,
  mapCallableError,
  REPORT_ERRORS,
  TRANSFER_INITIATE_ERRORS,
} from './callableErrors';

const fbError = (code: string, message = 'raw server text') => Object.assign(new Error(message), { code });

describe('mapCallableError', () => {
  it('maps listed codes to the call site copy', () => {
    expect(mapCallableError(fbError('functions/already-exists'), REPORT_ERRORS).message).toBe(REPORT_DUPLICATE);
    expect(mapCallableError(fbError('functions/resource-exhausted'), REPORT_ERRORS).message).toBe(REPORT_RATE);
  });

  it('maps offline and timeout codes to the timeout copy', () => {
    for (const code of ['functions/unavailable', 'functions/deadline-exceeded']) {
      expect(mapCallableError(fbError(code)).message).toBe(TIMEOUT_ERROR);
    }
  });

  it('maps everything else to generic copy and never leaks the raw message', () => {
    for (const e of [
      fbError('functions/failed-precondition', "You can't report your own memory."),
      fbError('functions/internal'),
      fbError('functions/already-exists'),
      new Error('boom'),
      'nope',
      null,
    ]) {
      expect(mapCallableError(e).message).toBe(GENERIC_ERROR);
    }
  });

  it('accepts codes without the functions/ prefix (in-memory backend failures)', () => {
    expect(mapCallableError(callableFailure('already-exists'), REPORT_ERRORS).message).toBe(REPORT_DUPLICATE);
    expect(callableFailure('resource-exhausted').code).toBe('functions/resource-exhausted');
  });

  it('maps the Plan 3 social call sites to their spec copy', () => {
    const cases: [unknown, Record<string, string | undefined>, string][] = [
      [fbError('functions/failed-precondition'), COMMUNITY_LEAVE_ERRORS, OWNER_CANNOT_LEAVE],
      [fbError('functions/already-exists'), TRANSFER_INITIATE_ERRORS, TRANSFER_DUPLICATE],
      [fbError('functions/permission-denied'), TRANSFER_INITIATE_ERRORS, GENERIC_ERROR],
      [fbError('functions/failed-precondition'), CLAIM_ADMIN_ERRORS, VERIFY_EMAIL_FIRST],
      [fbError('functions/permission-denied'), CLAIM_ADMIN_ERRORS, EMAIL_DOMAIN_NOT_APPROVED],
      [fbError('functions/not-found'), CLAIM_ADMIN_ERRORS, GENERIC_ERROR],
    ];
    for (const [e, copy, expected] of cases) expect(mapCallableError(e, copy).message).toBe(expected);
  });
});
