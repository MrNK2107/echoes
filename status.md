# ECHOES — Ground Truth Status

**Updated:** October 19, 2026  
**Target:** Production-ready v1 for Android and iOS, age 13+

## Expo rewrite - Plan 5

Plan 5 (launch readiness) delivered: report and moderation pipeline, admin subcollection and institution admin migration, server-side rollups (time/era `memberCount` from a `count()` of `members`), push receipt polling (`checkPushReceipts`) with TTL policies declared in `firestore.indexes.json`, fail-closed block handling, accessibility and safe-area fixes, account repair and finish-setup flows, Android and iOS config for store builds, Sentry crash reporting (ADR-0011, off without a DSN), listener budgets, Maestro flows and the 30-day restore flow (ADR-0012), the data backfill tool and runbook, store and privacy material, and removal of the Flutter client. The export bundle budget was amended to 7 864 320 bytes (R5-4). Camera AR stays off pending a compatible viro.

| Command | Result |
| --- | --- |
| `cd mobile && npx jest` (3 runs) | Pass (88 suites, 1116 tests, identical each run) |
| `cd mobile && npx jest --randomize` | Pass (88 suites, 1116 tests, seed -1867974891) |
| `cd mobile && npx tsc --noEmit` | Pass |
| `cd mobile && npx eslint .` | Pass (0 errors, 4 `no-require-imports` warnings in jest.setup.ts) |
| `npm test` in `functions/` | Pass (365 tests) |
| `npx firebase-tools emulators:exec --project demo-echoes --only auth,firestore,storage,functions "npm --prefix mobile run test:emulator"` | Pass (72 passed, 1 skipped) |
| `npx firebase-tools emulators:exec --project demo-echoes --only firestore,storage "npm test --prefix rules_test"` | Pass (57 tests) |
| `node scripts/build-rules.js` then `git status --porcelain` | Pass (clean) |
| `FIREBASE_STORAGE_BUCKET=demo-echoes.appspot.com node scripts/build-rules.js --prod`, then `git checkout firestore.rules` | Pass (tree clean afterwards) |
| `cd mobile && npx expo export --platform android --output-dir dist` and `--platform ios --output-dir dist-ios` | Pass |
| `cd mobile && npm run check:bundle` | Pass (android 7,336,536 bytes, ios 7,337,246 bytes, budget 7,864,320) |

### Owner-gate checklist (none done)

- [ ] EAS credentials configured and production builds made (Android app bundle, iOS)
- [ ] Play Console and App Store Connect listings and privacy labels submitted (`docs/store/`)
- [ ] Legal pages hosted and `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_GUIDELINES_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL` set
- [ ] Sentry project created, DSN set, `SENTRY_AUTH_TOKEN` EAS secret set, symbolicated test crash confirmed, retention confirmed
- [ ] `GOOGLE_MAPS_ANDROID_API_KEY` set as an EAS secret for production Android
- [ ] Maestro flows run on a device against the `e2e` build (index selectors unverified)
- [ ] Backfills applied in runbook order (emulator rehearsal first), then `migrateInstitutionAdmins --apply`
- [ ] TTL policies deployed with indexes, PITR, backups and alerts configured
- [ ] `EXPO_ACCESS_TOKEN` set in `functions/.env.<projectId>` and enhanced push security enabled
- [ ] Device performance measured against the budgets (cold start 3 s, memory load 2 s, location update 1 s)
- [ ] Camera AR still off pending a compatible `@reactvision/react-viro` (do not ship on mocks)
- [ ] First green `.github/workflows/ci.yml` run on GitHub

### Known follow-ups

- Drop the legacy `adminUserIds` fallback in `functions/institutions.js` once `migrateInstitutionAdmins` dry run shows `changed=0` (C11).
- Report id `_` collision assumption comment; memory-backend shared-budget test.
- Rollup `rolledUpAt` skip optimisation; demo emulation lower window bound.
- Receipt deletes could use `BulkWriter`; backfill makes one pass per task over `memories` (two for `all`).
- 15 hand-wrapped test files not migrated to `renderWithServices`; uid-switch test never red.
- `InstitutionsScreen` list refresh throttle (only `InstitutionScreen` covered).
- AR nearby places load once while AR is open, so aura colour can be stale until reopened (R5-5); empty first snapshot shows the empty state while the listener stays open (R5-6).
- iOS camera string omits AR wording until camera AR ships (R5-7).
- Maestro index selectors unverified; Plan 4 follow-ups below still apply except receipt polling, which now exists.

---

## Expo rewrite — Plan 4

Plan 4 (push and AR) adds Expo Push delivery for inbox notifications (`functions/push.js` `onNotificationCreated`: at most the 10 most recently seen tokens per user, chunks of 100, `DeviceNotRegistered` pruning; `onPushTokenCreated` dedupes a token across users on shared phones), client registration on sign-in or opt-in and unregistration on sign-out, tap routing from a notification to its target, and an AR screen. **`@reactvision/react-viro` does not install on Expo SDK 58 / RN 0.88 (ERESOLVE), so per R-P4-9 the 2D radar is the AR experience everywhere today.** The camera AR code (the `ViroArScene` factory) switches on automatically once a compatible viro installs; its Viro API usage is unverified until then.

| Command | Result |
| --- | --- |
| `cd mobile && npx jest` (3 runs) | Pass (68 suites, 935 tests, identical each run) |
| `cd mobile && npx jest --randomize` | Pass (68 suites, 935 tests) |
| `cd mobile && npx tsc --noEmit` | Pass |
| `cd mobile && npx eslint .` | Pass (0 errors, 4 `no-require-imports` warnings in jest.setup.ts) |
| `npm test` in `functions/` | Pass (252 tests) |
| `npx firebase-tools emulators:exec --project demo-echoes --only auth,firestore,storage,functions "npm --prefix mobile run test:emulator"` | Pass (68 passed, 1 skipped) |
| `npx firebase-tools emulators:exec --only firestore,storage --project demo-echoes "cd rules_test && npm test"` | Pass (46 tests) |
| `node scripts/build-rules.js` then `git status --porcelain` | Pass (no rules changes, generated rules in sync) |
| `cd mobile && npx expo export --platform android` and `--platform ios` | Pass (both bundles exported) |

### Device-only checklist

- [ ] Owner runs `npx eas-cli init`, sets `EXPO_PUBLIC_EAS_PROJECT_ID`, builds and installs the development build (`npx eas-cli build --profile development --platform android`)
- [ ] Push: opt in from the inbox or settings and accept the OS permission
- [ ] Push: trigger a notification (for example a transfer request); it arrives with the app backgrounded
- [ ] Push: tapping it opens the right screen, from cold start and from background
- [ ] Push: sign out on a shared phone; the previous user stops receiving pushes, and the next user's sign-in registers cleanly
- [ ] AR radar on a device: orbs and place target render, taps open the place or memory, the compass heading rotates the radar, and the radar falls back to north-up when the compass never reports (4 s timeout)
- [ ] Camera AR: once a compatible `@reactvision/react-viro` installs, verify the camera scene, orb placement, tap handling and the ARCore/ARKit fallback to radar

### Known follow-ups

- Viro is not installed (ERESOLVE on SDK 58 / RN 0.88). Camera AR is untested and its API usage and config-plugin options are unverified until it installs.
- AR and push have been validated only on mocks until a device run; an EAS build needs the owner's Expo account.
- Push receipt polling is not implemented (only ticket-level `DeviceNotRegistered` pruning); users with more than 10 devices miss pushes on the stale ones.
- Deploy `firestore.indexes.json` before relying on push: it carries the `pushTokens.token` collection-group override used by the dedupe trigger.
- Optional `EXPO_ACCESS_TOKEN` on functions enables Expo's enhanced push security.
- Radar polish for the device check: orb overlap across places in dense areas, ring crowding on small radars, safe-area back button, Firestore union listener cost (about 4 listeners per place).
- Push token registration re-runs on foreground rather than only on a not-granted to granted change; offline registration fails and is retried later.

---

## Expo rewrite — Plan 3

Plan 3 (social and safety) adds public profiles and people search, tagged and community privacy, server-authoritative communities, transfers and institutions (callables), a notifications inbox with preferences, safety (report, auto-hide at 3, block, profanity warning, terms acceptance, help and terms links) and an aura history chart.

| Command | Result |
| --- | --- |
| `npm --prefix mobile test` | Pass (55 suites, 755 tests; 3 consecutive runs plus 1 `--randomize` run, all identical and green) |
| `npm --prefix mobile run typecheck` | Pass |
| `npm --prefix mobile run lint` | Pass |
| `npm test --prefix functions` | Pass (225 tests) |
| `npx firebase emulators:exec --project demo-echoes --only auth,firestore,storage,functions "npm --prefix mobile run test:emulator"` | Pass (64 passed, 1 skipped) |
| `npx firebase emulators:exec --only firestore,storage "npm test --prefix rules_test"` | Pass (44 tests in the final summary) |
| `node scripts/build-rules.js && git diff --exit-code firestore.rules firestore.lan.rules` | Pass (generated rules in sync) |
| `cd mobile && npx expo export --platform android --output-dir dist && npx expo export --platform ios --output-dir dist-ios` | Pass (both bundles exported) |

### Manual Expo Go checklist

- [ ] Rename yourself in Profile, then find yourself via people search
- [ ] Tag another person in a memory; they see it under tagged
- [ ] Set community-only privacy on a memory; only members see it
- [ ] Create a community, join it, leave it, and invite someone
- [ ] Open the inbox, read and clear items, and change notification preferences
- [ ] Transfer: request, accept, decline and revoke
- [ ] Institution: register (staff), verify via the email admin claim, and add a sub-zone
- [ ] Report a memory from three accounts; it becomes hidden
- [ ] Block and unblock a user; their content hides and returns
- [ ] Type profane text; the warning appears
- [ ] Terms checkbox is required at sign-up and the Terms/Guidelines/support links open
- [ ] Aura history chart shows on the place screen

### Known follow-ups

- Push delivery landed in Plan 4 (see above).
- No staff review UI for reports or institution verification yet.
- Terms, Guidelines and support content is the owner's to write and host.
- Production rules must be generated with the real storage bucket (`FIREBASE_STORAGE_BUCKET`) and deployed only after the legacy data backfill sets `moderation: null` on existing memories; see docs/release-readiness.md.

---

## Expo rewrite — Plan 2

Plan 2 (memory lifecycle) adds memory detail/edit/delete/restore (Recently deleted, 30-day window, daily purge function), 60 s voice notes, a persisted offline outbox with permanent-failure parking (ADR-0006), profile with default privacy, and account deletion with re-authentication. Rules changed: authors read their own deleted memories; `audioUrl` and `sentiment` are mutable; update guards use `affectedKeys()`.

| Command | Result |
| --- | --- |
| `npm --prefix mobile test` | Pass (34 suites, 428 tests; 3 consecutive runs plus 1 `--randomize` run, all green) |
| `npm --prefix mobile run typecheck` | Pass |
| `npm --prefix mobile run lint` | Pass |
| `npm test --prefix functions` | Pass (36 tests) |
| `npx firebase emulators:exec --project demo-echoes --only auth,firestore,storage,functions "npm --prefix mobile run test:emulator"` | Pass (32 tests) |
| `npx firebase emulators:exec --only firestore "npm test --prefix rules_test"` | Pass (16 tests) |
| `cd mobile && npx expo export --platform android --output-dir dist && npx expo export --platform ios --output-dir dist-ios` | Pass (both bundles exported) |

### Manual Expo Go checklist

- [ ] Edit a memory's text and privacy; the change shows on the detail screen
- [ ] Delete a memory; it leaves the place and appears in Recently deleted
- [ ] Restore it from Recently deleted; it returns to the place
- [ ] Record a voice note (up to 60 s), then play it back
- [ ] Airplane mode: save a memory, reconnect, and confirm it syncs from the outbox
- [ ] Profile: change default privacy and confirm a new memory uses it
- [ ] Delete account (re-authenticate when prompted); you are signed out and data is gone

### Known follow-ups

- Real microphone recording and playback are not verified on a device.
- Offline airplane-mode save and reconnect is not verified on a phone.
- Account deletion in Firebase mode is not verified against a real project.

---

## Expo rewrite — Plan 1

The active client is now the React Native + Expo app in `mobile/` (branch `expo-rewrite`). Plan 1 (foundation and core loop) is verified by the gates below; the Flutter notes further down are historical.

| Command | Result |
| --- | --- |
| `npm --prefix mobile test` | Pass (21 suites, 251 tests) |
| `npm --prefix mobile run typecheck` | Pass |
| `npm --prefix mobile run lint` | Pass |
| `npm test --prefix functions` | Pass (29 tests) |
| `npx firebase emulators:exec --project demo-echoes --only auth,firestore,storage,functions "npm --prefix mobile run test:emulator"` | Pass (19 tests) |
| `npx firebase emulators:exec --only firestore "npm test --prefix rules_test"` | Pass (11 tests) |
| `cd mobile && npx expo export --platform android --output-dir dist && npx expo export --platform ios --output-dir dist-ios` | Pass (both bundles exported) |

### Manual Expo Go checklist

- [ ] `cd mobile && npx expo start`, scan the QR code with Expo Go
- [ ] Sign in with `demo@echoes.app` / `echoes-demo`
- [ ] Map shows 6+ markers
- [ ] Open a place
- [ ] Add a memory
- [ ] The memory appears on the place

### Known follow-ups

- Firebase and emulator modes are not yet smoke-tested on a device.
- Date picker and Google Maps rendering are not verified on a device.

---

## Outcome

The repository-side v1 implementation is complete. The app now has working
Firebase-backed and local-mode flows for authentication, users, memories,
places, maps, native AR scenes, voice notes, communities, institutions,
custodianship, aura history, notifications, offline retry, account deletion,
and 30-day memory restoration.

Production launch still requires the external configuration and physical-device
checks listed in `docs/release-readiness.md`. Those gates require production
credentials, signing identities, a Firebase project, and Apple hardware; they
cannot be completed from this Windows workspace.

## Completed in the July 31 hardening pass

- Replaced the simulated AR presentation with ARCore and ARKit scene views,
  retaining a safe 2D fallback.
- Added 60-second voice-note recording, Firebase Storage upload, and native
  Android/iOS playback.
- Added a real connectivity monitor and automatic pending-upload retry.
- Added Firestore-backed institution zones and administration UI.
- Added Firestore-backed aura history and visualization.
- Completed community feeds, guardian reassignment, account deletion, and
  30-day memory restore flows.
- Added server-side account cleanup for user-owned Firestore and Storage data.
- Tightened Firestore list authorization so broad queries cannot expose private
  memories.
- Migrated memory dates to Firestore timestamps with backward-compatible reads.
- Added Firestore composite indexes and Firebase index configuration.
- Added Android release signing and Maps-key injection requirements.
- Added 13+ registration confirmation and mobile permission descriptions.
- Added a device integration smoke test and Android emulator CI job.

## Verified

| Gate | Result |
| --- | --- |
| `flutter analyze` | Pass — no issues |
| `flutter test` | Pass — 182 tests |
| Functions lint/tests | Pass — 2 tests |
| Firestore emulator rules | Pass — 11 tests |
| Android debug compilation | Pass |
| JSON/YAML parsing | Pass |
| `git diff --check` | Pass |

## External release gates

- Add production Firebase configuration files and deploy rules, indexes,
  Storage rules, and Functions.
- Supply restricted Google Maps keys and Android release-signing secrets.
- Run the Android hardware matrix, including ARCore and performance targets.
- Build, archive, and test iOS on macOS with signing and a physical ARKit device.
- Complete store privacy, age-rating, support, and account-deletion disclosures.

See `docs/release-readiness.md` for the executable checklist.
