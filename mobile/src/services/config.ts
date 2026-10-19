export type BackendMode = 'memory' | 'emulator' | 'firebase';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  appId: string;
  messagingSenderId: string;
}

export interface AppConfig {
  backend: BackendMode;
  emulatorHost: string;
  firebase: FirebaseConfig | null;
  /** ADR-0008: the Terms of Service and Community Guidelines pages linked from registration. */
  termsUrl: string;
  guidelinesUrl: string;
  /** The privacy policy page linked from registration, finish-setup and the profile (store listings require it). */
  privacyUrl: string;
  /** ADR-0008: the address behind the profile's `Help & support` link. */
  supportEmail: string;
  /** ADR-0011: Sentry DSN; null keeps crash reporting off. */
  sentryDsn: string | null;
}

export const DEFAULT_TERMS_URL = 'https://echoes.app/terms';
export const DEFAULT_GUIDELINES_URL = 'https://echoes.app/guidelines';
export const DEFAULT_PRIVACY_URL = 'https://echoes.app/privacy';
export const DEFAULT_SUPPORT_EMAIL = 'support@echoes.app';

const EMULATOR_FIREBASE: FirebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-echoes.firebaseapp.com',
  projectId: 'demo-echoes',
  storageBucket: 'demo-echoes.appspot.com',
  appId: 'demo-app-id',
  messagingSenderId: '0',
};

const FIREBASE_KEYS: [keyof FirebaseConfig, string][] = [
  ['apiKey', 'API_KEY'],
  ['authDomain', 'AUTH_DOMAIN'],
  ['projectId', 'PROJECT_ID'],
  ['storageBucket', 'STORAGE_BUCKET'],
  ['appId', 'APP_ID'],
  ['messagingSenderId', 'MESSAGING_SENDER_ID'],
];

/** Placeholders must never ship: a firebase (production-like) build refuses to start without these. */
const REQUIRED_FOR_FIREBASE = [
  'EXPO_PUBLIC_TERMS_URL',
  'EXPO_PUBLIC_GUIDELINES_URL',
  'EXPO_PUBLIC_PRIVACY_URL',
  'EXPO_PUBLIC_SUPPORT_EMAIL',
  'EXPO_PUBLIC_EAS_PROJECT_ID',
];

function isBackendMode(v: string): v is BackendMode {
  return v === 'memory' || v === 'emulator' || v === 'firebase';
}

/**
 * Pure: pass an explicit object. In the bundled app `process.env` cannot be passed whole
 * (Expo inlines only static `process.env.EXPO_PUBLIC_X` accesses).
 */
export function readConfig(env: Record<string, string | undefined>): AppConfig {
  const raw = env.EXPO_PUBLIC_BACKEND || 'memory';
  if (!isBackendMode(raw)) throw new Error(`Unknown EXPO_PUBLIC_BACKEND: ${raw}`);
  const emulatorHost = env.EXPO_PUBLIC_EMULATOR_HOST || '127.0.0.1';

  let firebase: FirebaseConfig | null = null;
  if (raw === 'emulator') {
    firebase = { ...EMULATOR_FIREBASE };
  } else if (raw === 'firebase') {
    const out = {} as FirebaseConfig;
    for (const [field, suffix] of FIREBASE_KEYS) {
      const value = env[`EXPO_PUBLIC_FIREBASE_${suffix}`];
      if (!value) throw new Error(`Missing EXPO_PUBLIC_FIREBASE_${suffix}`);
      out[field] = value;
    }
    firebase = out;
    for (const key of REQUIRED_FOR_FIREBASE) {
      if (!env[key]) throw new Error(`Missing ${key}`);
    }
  }
  return {
    backend: raw,
    emulatorHost,
    firebase,
    termsUrl: env.EXPO_PUBLIC_TERMS_URL || DEFAULT_TERMS_URL,
    guidelinesUrl: env.EXPO_PUBLIC_GUIDELINES_URL || DEFAULT_GUIDELINES_URL,
    privacyUrl: env.EXPO_PUBLIC_PRIVACY_URL || DEFAULT_PRIVACY_URL,
    supportEmail: env.EXPO_PUBLIC_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL,
    sentryDsn: env.EXPO_PUBLIC_SENTRY_DSN || null,
  };
}
