# ECHOES Production Release Gates

Repository automation must be green before device validation:

```powershell
flutter analyze
flutter test
flutter test integration_test -d <device-id>
npm test --prefix functions
npx firebase emulators:exec --only firestore,storage "npm test --prefix rules_test"
```

## Required external configuration

- Supply Firebase Android/iOS apps and native configuration files.
- Restrict Google Maps keys by application/package and signing certificate.
- Set `MAPS_API_KEY` or `GOOGLE_MAPS_ANDROID_API_KEY` for Android builds.
- Set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` for release signing.
- Deploy Firestore rules, indexes, Storage rules, and Cloud Functions to the
  selected production Firebase project.
- Build the Firestore rules for the production bucket first. `firestore.rules` is
  generated from `firestore.rules.template` and pins the Storage bucket that memory
  media URLs must use; the committed copy pins the emulator bucket. Set
  `FIREBASE_STORAGE_BUCKET` to the exact bucket name from the Firebase console
  (e.g. `<project>.firebasestorage.app`) and run
  `npm run deploy:rules -- --project <project-id>` (it refuses to run without the
  variable). Never deploy `firestore.lan.rules` (it accepts private-LAN emulator
  hosts and is used only by `firebase.lan.json`).
- **Deploying the Plan 3 rules retires the legacy Flutter client.** Its direct
  writes to communities, memberships, transfers, institutions, places and
  `notificationRequests`, and its memory creates without `moderation: null`, are
  all denied. Ship the Expo app to the stores before (or together with) this
  deploy, and backfill `moderation: null` on existing memories (memories without
  the field are hidden from non-authors).

## Android device gate

- Sign up (13+ confirmation), sign in, delete the account, and confirm backend
  cleanup of profile, memory media, memberships, transfers, and notifications.
- Exercise location and notification allow/deny/permanently-denied states.
- Create text, image, and 60-second voice-note memories across all privacy modes.
- Verify offline image retry when connectivity returns.
- Verify Maps markers/details, community and institution persistence, aura
  history, custodianship transfer, and 30-day restore.
- Verify ARCore aura nodes and memory navigation on an AR device; verify the 2D
  fallback on a non-AR device.
- Measure launch under 3 seconds, memory load under 2 seconds, location update
  under 1 second, and AR at 30 FPS or better on a mid-range device.

## iOS/macOS gate

- Build and archive on macOS with the production bundle ID and signing profile.
- Repeat the Android functional matrix on iOS 15+.
- Verify ARKit lifecycle across background/foreground and repeated scene opens.
- Complete App Store privacy labels, age rating (13+), support URL, privacy
  policy, and account-deletion disclosure.

## Expo Plan 3 backend runbook

Do these before shipping the Expo client.

- **Indexes first.** Run `firebase deploy --only firestore:indexes` and wait for
  the indexes to finish building before the client ships; the new queries fail
  without them.
- **`deploy:rules` rewrites rules files.** `npm run deploy:rules` regenerates
  `firestore.rules` and `firestore.lan.rules` with the production bucket. Do not
  commit those changes; the committed copies pin the emulator bucket.
- **Legacy community members lack `userId`.** Member docs written by the Flutter
  client have no `userId` field, which the new collection-group queries and
  cleanup rely on. Backfill `userId` from the member doc id, or drop the legacy
  communities.
- **Restoring hidden memories.** Staff restore a hidden memory by setting
  `moderation` to `null`. Never delete the field: a memory without it is hidden
  from non-authors (ADR-0008).
- **TTL policies** are declared in `firestore.indexes.json` (`fieldOverrides` with
  `ttl: true`) and deploy with `firebase deploy --only firestore:indexes`; no
  console step is needed:
  - `rateLimits.expireAt` (counters expire two days after their UTC day starts);
  - `notifications.expireAt` (notifications expire 90 days after `createdAt`);
  - `pushReceipts.expireAt` (push receipts expire one day after the ticket).
  TTL deletion is not instant; expired docs may linger for up to a day or so.
- **Client item C8.** Set real `EXPO_PUBLIC_TERMS_URL`,
  `EXPO_PUBLIC_GUIDELINES_URL` and `EXPO_PUBLIC_SUPPORT_EMAIL` values before store
  submission. The defaults point at `echoes.app` and must not ship.
- **Push delivery (required launch step).** Enable enhanced push security in the Expo
  dashboard and set `EXPO_ACCESS_TOKEN` as a function secret or environment variable
  before launch; the function then sends `Authorization: Bearer <token>`. Without it
  anyone who learns a push token could send to it. Push works without it in development.
- **EAS environment.** Preview and production builds set `EXPO_PUBLIC_BACKEND=firebase`
  (in `mobile/eas.json`) and need these EAS environment variables: all
  `EXPO_PUBLIC_FIREBASE_*` keys (API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET,
  APP_ID, MESSAGING_SENDER_ID), `EXPO_PUBLIC_EAS_PROJECT_ID`, `EXPO_PUBLIC_TERMS_URL`,
  `EXPO_PUBLIC_GUIDELINES_URL` and `EXPO_PUBLIC_SUPPORT_EMAIL`, plus the build-time secret
  `GOOGLE_MAPS_ANDROID_API_KEY` (Android Google Maps key, set as an EAS secret; the maps
  block is omitted when it is absent). The development profile
  needs `EXPO_PUBLIC_EMULATOR_HOST` set to the PC's LAN IP for physical phones.

## Expo Plan 5 data backfill runbook

Run in this order against the production project (always `--project <id>`; the tool refuses to run without one and is a dry run unless `--apply` is passed):

1. Deploy indexes: `npx firebase deploy --only firestore:indexes --project <id>`; wait for them to build.
2. Deploy functions.
3. Dry run: `node functions/tools/backfill.js all --project <id>` and read the per-task summary (`invalid=` counts `releaseDate` strings that could not be parsed; they are left untouched for manual review).
4. `node functions/tools/backfill.js all --apply --project <id>` (moderation, releaseDate, member `userId`). Until it runs, string `releaseDate` memories never notify.
5. `node functions/tools/backfill.js migrateInstitutionAdmins --apply --project <id>` (copies `adminUserIds` into `admins/{uid}` and deletes the field). Dry run it first.
6. Optional cleanup: `node functions/tools/backfill.js deleteLegacyNotificationRequests --apply --project <id>`.
7. Release the client.

Every task is idempotent and resumable (re-run, or `--resume-after <doc path>`). Set `FIRESTORE_EMULATOR_HOST` to rehearse against the emulator. No member-count backfill exists: `rollupMemberCounts` derives `memberCount` from a `count()` of `members`.

## Expo Plan 4 push and AR runbook

- **EAS credentials:** the owner runs `npx eas-cli init` in `mobile/` and sets `EXPO_PUBLIC_EAS_PROJECT_ID` (local `.env` and EAS environment variables). Configure Android FCM credentials (upload the Firebase service account key / `google-services.json` through `eas credentials`) and iOS APNs credentials (EAS manages the key with an Apple Developer account). Without them Expo Push cannot deliver to physical devices.
- **Expo Push:** `functions/push.js` sends via the Expo push API. Set `EXPO_ACCESS_TOKEN` on the functions environment (Expo account token) to authenticate requests; it is required at launch (enhanced push security). Token docs must match `ExponentPushToken[...]`/`ExpoPushToken[...]` (enforced by rules) and a user keeps at most 10 tokens. Sends go to at most the 10 most recently seen tokens per user, in chunks of 100; `DeviceNotRegistered` tickets prune the token. Receipt polling is not implemented.
- **Index deploy:** run `npx firebase deploy --only firestore:indexes --project <project-id>` before shipping. `firestore.indexes.json` includes the `pushTokens.token` collection-group field override that `onPushTokenCreated` uses to dedupe a token across users on shared phones.
- **Deploy functions** (`onNotificationCreated`, `onPushTokenCreated`) together with the indexes.
- **ARCore/ARKit device matrix:** test on at least one ARCore-supported Android device, one non-ARCore Android device, one ARKit iPhone (iOS 15+) and, if possible, a low-end device. Record radar behaviour (orbs, compass heading, 4 s north-up fallback) and, once camera AR is enabled, camera scene, FPS (30 or better) and the fallback to radar.
- **Viro compatibility gate:** `@reactvision/react-viro` currently fails to install on Expo SDK 58 / RN 0.88 (ERESOLVE), so the radar is the shipping AR experience. Before enabling camera AR in a release, install a compatible viro version, verify its API usage and config-plugin options (unverified today), and complete the camera AR device matrix above. Do not ship camera AR on the strength of mocks alone.
