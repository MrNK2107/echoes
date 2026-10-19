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
- **TTL policies** (Firestore console or `gcloud firestore fields ttls update`):
  - collection group `rateLimits`, field `expireAt` (counters expire two days
    after their UTC day starts);
  - collection group `notifications`, field `expireAt` (notifications expire 90
    days after `createdAt`).
  TTL deletion is not instant; expired docs may linger for up to a day or so.
- **Client item C8.** Set real `EXPO_PUBLIC_TERMS_URL`,
  `EXPO_PUBLIC_GUIDELINES_URL` and `EXPO_PUBLIC_SUPPORT_EMAIL` values before store
  submission. The defaults point at `echoes.app` and must not ship.
- **Push delivery (optional hardening).** `onNotificationCreated` sends to the Expo
  Push Service without credentials by default. For enhanced push security, enable
  it in the Expo dashboard and set `EXPO_ACCESS_TOKEN` as a function secret or
  environment variable; the function then sends `Authorization: Bearer <token>`.
  Not required for push to work.
