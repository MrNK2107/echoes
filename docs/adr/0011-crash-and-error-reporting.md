# ADR-0011: Crash and error reporting with Sentry (client) and Cloud Error Reporting (functions)

**Status:** Accepted
**Date:** 2026-10-19

## Context
A public launch needs crash and JavaScript-error visibility from real devices.
- The client uses the Firebase **JS** SDK (ADR-0002) and must keep running in Expo Go, dev builds and Jest without any account or key.
- The functions already log through `firebase-functions` `logger`.

The two candidates:
- **Firebase Crashlytics** (`@react-native-firebase/crashlytics`). It needs the native React Native Firebase app module next to the JS SDK (two Firebase stacks, against ADR-0002). It does not run in Expo Go, and its JS-error stack traces are weaker than Sentry's source-mapped ones.
- **Sentry** (`@sentry/react-native`). It has an Expo config plugin, uploads source maps from EAS builds, reports native crashes and JS errors, tracks app-start performance and release health, and has a free tier.

## Decision
- **Client: `@sentry/react-native`**, behind a `CrashReporter` interface in `mobile/src/device/crashReporter.ts`:
  - `noopCrashReporter` is used when `EXPO_PUBLIC_SENTRY_DSN` is empty, in Expo Go (`Constants.appOwnership === 'expo'`) and in tests. Sentry is loaded only through a guarded dynamic `require`.
  - The Sentry config plugin (`@sentry/react-native/expo`) is added in `app.config.ts` only when `SENTRY_ORG` and `SENTRY_PROJECT` are set. EAS builds also need `SENTRY_AUTH_TOKEN` as an EAS secret for source maps.
  - Privacy: `sendDefaultPii: false`, no `setUser`, no session replay. `beforeSend` and `beforeBreadcrumb` drop URLs' query strings and any `ExponentPushToken[...]` or email-shaped strings. `tracesSampleRate: 0.1`. `environment` is the backend mode, `release` is the app version.
  - The root error boundary reports and shows the generic error copy.
- **Functions: Google Cloud Error Reporting**, which picks up `logger.error` with stack traces automatically. Cloud Monitoring alert policies (in the runbook) cover function error rate, push failures and Firestore usage. No extra dependency.

## Consequences
- **Easier:** one switch (the DSN) turns reporting on, and Expo Go, Jest and contributors without accounts are unaffected.
- **Harder:** client and server errors live in two consoles, linked by time and function name. The store privacy labels must declare "Crash logs" and "Diagnostics" (not linked to identity).
