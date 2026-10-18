import { GENERIC_ERROR, REPORT_DUPLICATE, REPORT_RATE, TIMEOUT_ERROR } from './errors';
import { callableFailure, mapCallableError, REPORT_ERRORS } from './callableErrors';

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
});
