import type { BackendMode } from '@/services/config';

import { isExpoGo } from './expoGo';
import type { CrashReporter } from './types';

const PUSH_TOKEN = /Expo(?:nent)?PushToken\[[^\]]*\]/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// A query string is `?` followed by key=value pairs; it ends at whitespace, a quote or a fragment.
const QUERY = /\?[^\s"'#]*=[^\s"'#]*/g;
const MAX_DEPTH = 12;

function scrubString(s: string): string {
  return s.replace(PUSH_TOKEN, '[push-token]').replace(QUERY, '').replace(EMAIL, '[email]');
}

function walk(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > MAX_DEPTH || seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = walk(v, depth + 1, seen);
  return out;
}

/** Removes query strings, Expo push tokens and email-shaped substrings from any string in an event or breadcrumb. */
export function scrub<T>(event: T): T {
  return walk(event, 0, new WeakSet()) as T;
}

export const noopCrashReporter: CrashReporter = {
  init() {},
  captureException() {},
};

interface SentryApi {
  init(options: Record<string, unknown>): void;
  captureException(e: unknown, hint?: { tags?: Record<string, string> }): void;
}

export interface CrashReporterOptions {
  dsn: string | null;
  appOwnership: string | null;
  environment: BackendMode;
  release: string;
}

/** Noop without a DSN and in Expo Go; Sentry is required lazily so nothing loads in those cases or in tests. */
export function createCrashReporter(opts: CrashReporterOptions): CrashReporter {
  if (!opts.dsn || opts.appOwnership === 'expo' || isExpoGo()) return noopCrashReporter;
  const dsn = opts.dsn;
  let sentry: SentryApi | null = null;
  return {
    init() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native dep, must be lazy
        const mod = require('@sentry/react-native') as SentryApi;
        mod.init({
          dsn,
          sendDefaultPii: false,
          tracesSampleRate: 0.1,
          environment: opts.environment,
          release: opts.release,
          beforeSend: scrub,
          beforeBreadcrumb: scrub,
        });
        sentry = mod;
      } catch {
        sentry = null;
      }
    },
    captureException(e, context) {
      try {
        sentry?.captureException(e, context ? { tags: context } : undefined);
      } catch {
        // Reporting must never throw into the app.
      }
    },
  };
}
