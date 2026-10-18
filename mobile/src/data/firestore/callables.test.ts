import type { Functions } from 'firebase/functions';
import { GENERIC_ERROR, REPORT_DUPLICATE, TIMEOUT_ERROR } from '../errors';
import { REPORT_ERRORS } from '../callableErrors';
import { CALLABLE_TIMEOUT_MS, callCallable, type CallableClient } from './callables';

let mockFailure: unknown = null;
const mockOptions: unknown[] = [];

jest.mock('firebase/functions', () => ({
  httpsCallable: (_functions: unknown, _name: string, options: unknown) => {
    mockOptions.push(options);
    return async () => {
      if (mockFailure !== null) throw mockFailure;
      return { data: { ok: true } };
    };
  },
}));

const fbError = (code: string) => Object.assign(new Error('raw server text'), { code });

function client(online: boolean | 'throws'): CallableClient & { checks: number } {
  const c = {
    functions: {} as Functions,
    checks: 0,
    isOnline: async () => {
      c.checks += 1;
      if (online === 'throws') throw new Error('no network state');
      return online;
    },
  };
  return c;
}

describe('callCallable', () => {
  beforeEach(() => {
    mockFailure = null;
    mockOptions.length = 0;
  });

  it('returns the data and gives up after 15 s', async () => {
    await expect(callCallable(client(true), 'f', {})).resolves.toEqual({ ok: true });
    expect(CALLABLE_TIMEOUT_MS).toBe(15_000);
    expect(mockOptions).toEqual([{ timeout: 15_000 }]);
  });

  it('maps internal to timeout copy when the device is offline', async () => {
    mockFailure = fbError('functions/internal');
    await expect(callCallable(client(false), 'f', {})).rejects.toThrow(TIMEOUT_ERROR);
  });

  it('maps internal to generic copy when the device is online', async () => {
    mockFailure = fbError('functions/internal');
    await expect(callCallable(client(true), 'f', {})).rejects.toThrow(GENERIC_ERROR);
  });

  it('treats a failing connectivity check as online', async () => {
    mockFailure = fbError('functions/internal');
    await expect(callCallable(client('throws'), 'f', {})).rejects.toThrow(GENERIC_ERROR);
  });

  it('maps deadline-exceeded and unavailable to timeout copy without asking connectivity', async () => {
    for (const code of ['functions/deadline-exceeded', 'functions/unavailable']) {
      mockFailure = fbError(code);
      const c = client(true);
      await expect(callCallable(c, 'f', {})).rejects.toThrow(TIMEOUT_ERROR);
      expect(c.checks).toBe(0);
    }
  });

  it('lets call-site copy win even when offline', async () => {
    mockFailure = fbError('functions/already-exists');
    await expect(callCallable(client(false), 'f', {}, REPORT_ERRORS)).rejects.toThrow(REPORT_DUPLICATE);
  });
});
