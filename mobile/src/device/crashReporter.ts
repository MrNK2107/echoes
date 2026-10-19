import type { BackendMode } from '@/services/config';

import { isExpoGo } from './expoGo';
import type { CrashReporter } from './types';

const PUSH_TOKEN = /Expo(?:nent)?PushToken\[[^\]]*\]/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// A query string is `?` followed by key=value pairs; it ends at whitespace, a quote or a fragment.
const QUERY = /\?[^\s"'#]*=[^\s"'#]*/g;
// OAuth-style fragments carry tokens (`#access_token=...`); plain anchors like `#top` stay.
const FRAGMENT = /#[^\s"'#]*=[^\s"'#]*/g;
const BEARER = /Bearer\s+\S+/gi;
// Storage and Firestore paths embed the uid (`memory-images/<uid>/...`, `users/<uid>`); Storage URLs may encode the slash.
const STORAGE_UID = /memory-(images|audio)(\/|%2F)[^/\s%"'?#]+(?=\/|%2F)/gi;
const DOC_UID = /\b(users|publicProfiles)\/[^/\s"'?#]+/g;
// Span attributes such as `http.query` / `url.query` hold the bare query (no leading `?`).
const BARE_QUERY_KEY = /(^|[._-])(query|fragment)$/i;
const MAX_DEPTH = 12;

function scrubString(s: string): string {
  return s
    .replace(PUSH_TOKEN, '[push-token]')
    .replace(BEARER, '[bearer]')
    .replace(STORAGE_UID, (_m, kind: string, sep: string) => `memory-${kind}${sep}[uid]`)
    .replace(DOC_UID, '$1/[uid]')
    .replace(QUERY, '')
    .replace(FRAGMENT, '')
    .replace(EMAIL, '[email]');
}

/** `copies` maps each input object to its scrubbed copy, so a shared reference is scrubbed wherever it appears (and cycles terminate). */
function walk(value: unknown, depth: number, copies: Map<object, unknown>): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  const known = copies.get(value);
  if (known !== undefined) return known;
  if (depth > MAX_DEPTH) return '[depth]';
  if (Array.isArray(value)) {
    const arr: unknown[] = [];
    copies.set(value, arr);
    value.forEach((v) => arr.push(walk(v, depth + 1, copies)));
    return arr;
  }
  const out: Record<string, unknown> = {};
  copies.set(value, out);
  for (const [k, v] of Object.entries(value)) {
    out[k] = typeof v === 'string' && BARE_QUERY_KEY.test(k) ? '' : walk(v, depth + 1, copies);
  }
  return out;
}

/** Removes query strings, Expo push tokens and email-shaped substrings from any string in an event, transaction, span or breadcrumb. */
export function scrub<T>(event: T): T {
  return walk(event, 0, new Map()) as T;
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
          beforeSend: scrub,
          beforeBreadcrumb: scrub,
          beforeSendTransaction: scrub,
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
