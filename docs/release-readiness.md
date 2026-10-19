# ECHOES Production Release Gates

The Expo app in `mobile/` is the shipping client. The deploy order, backups, alerts, incident and moderation procedures are in `docs/ops/runbook.md`; the store listing and privacy labels are in `docs/store/`. Items below are owner gates unless they say otherwise; none is complete until a person does it.

## Repository automation (must be green first)

```powershell
cd mobile
npm run typecheck
npm run lint
npm test
npx expo export --platform android --output-dir dist
npx expo export --platform ios --output-dir dist-ios
npm run check:bundle
cd ..
npm test --prefix functions
npx firebase emulators:exec --only firestore,storage "npm test --prefix rules_test"
```

`npm run check:bundle` fails when either exported Hermes bundle exceeds 7 864 320 bytes (needs both `dist` and `dist-ios`).

**Owner gate:** the first `.github/workflows/ci.yml` run on GitHub is green (the workflow cannot be proven locally; `mobile/test/ciWorkflow.test.ts` only checks its shape).

## Required external configuration

- Firebase production project: Auth, Firestore, Storage, Functions and the `EXPO_PUBLIC_FIREBASE_*` keys.
- **Google Maps:** `GOOGLE_MAPS_ANDROID_API_KEY` must be set as an EAS secret for production Android builds; without it the maps config is omitted and the map does not render on the store build. Restrict the key by package and signing certificate.
- **Sentry (ADR-0011):** create the Sentry project; set `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG` and `SENTRY_PROJECT` as EAS environment variables and `SENTRY_AUTH_TOKEN` as an EAS secret. Reporting is off without a DSN and always off in Expo Go. Gate: produce a test crash from a production-profile build and confirm it is symbolicated in Sentry (readable stack, release `bundleId@version+build`).
- **Push:** put `EXPO_ACCESS_TOKEN=...` in the gitignored `functions/.env.<projectId>` and enable enhanced push security in Expo (details below).
- **Rules:** build the Firestore rules for the production bucket first. `firestore.rules` is generated from `firestore.rules.template` and the committed copy pins the emulator bucket. Set `FIREBASE_STORAGE_BUCKET` and run `npm run deploy:rules -- --project <project-id>` (it refuses to run without the variable), then `git checkout firestore.rules`. Never deploy `firestore.lan.rules`.
- **Deploying the Plan 3 rules retires the legacy Flutter client.** Its direct writes are denied and memories without `moderation` are hidden from non-authors. Release order: indexes, functions, backfill emulator rehearsal, backfill dry run, client approved and released, then rules (`npm run deploy:rules`, then `git checkout firestore.rules`), then `backfill all --apply` straight after, then `migrateInstitutionAdmins --apply`. The legacy Flutter client is locked out by the new rules, so the Expo client must be live first (full steps in `docs/ops/runbook.md`).
- Android signing and the Apple signing profile are managed through EAS credentials.

## Device and store gates

- Android and iOS (iOS 15+): sign up with the 13+ terms checkbox, sign in, delete the account, confirm backend cleanup (profile, media, memberships, transfers, notifications).
- Location and notification allow, deny and permanently-denied states.
- Create text, photo and 60-second voice-note memories in every privacy mode; offline retry when connectivity returns.
- Maps markers and details, communities, institutions, aura history, custodianship transfer, 30-day restore, report and block.
- **Maestro:** run `mobile/.maestro` on a device against the `e2e` EAS build (README, "End-to-end flows"). CI cannot do this and the index selectors are unverified.
- **AR device matrix** (Plan 4 section below). Camera AR is not shipped; the radar is.
- Performance on a mid-range phone: cold start under 3 s, memory load under 2 s, location update under 1 s.
- Store submission: privacy labels, age rating, listing, screenshots, support URL, privacy policy, reviewer account (`docs/store/`).
- Legal text: `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_GUIDELINES_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL` must be real (client item C8); the `echoes.app` defaults must not ship.

## Expo Plan 3 backend notes

- **Indexes first.** `firebase deploy --only firestore:indexes` and wait for the build before the client ships.
- **`deploy:rules` rewrites `firestore.rules`.** Do not commit the change; run `git checkout firestore.rules`.
- **Restoring hidden memories.** Staff set `moderation` to `null`; never delete the field (ADR-0008).
- **TTL policies** are declared in `firestore.indexes.json` (`fieldOverrides` with `ttl: true`) and deploy with `firebase deploy --only firestore:indexes`: `rateLimits.expireAt` (two days after the UTC day starts), `notifications.expireAt` (90 days after `createdAt`), `pushReceipts.expireAt` (one day after the ticket). TTL deletion is not instant.
- **Push delivery (required launch step).** Enable enhanced push security in the Expo dashboard and put `EXPO_ACCESS_TOKEN=...` in the gitignored `functions/.env.<projectId>` (`functions/push.js` reads `process.env`; there is no `defineSecret`) and redeploy functions; the function then sends `Authorization: Bearer <token>`. Without it anyone who learns a push token could send to it.
- **EAS environment.** Preview and production builds set `EXPO_PUBLIC_BACKEND=firebase` (in `mobile/eas.json`) and need all `EXPO_PUBLIC_FIREBASE_*` keys (API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, APP_ID, MESSAGING_SENDER_ID), `EXPO_PUBLIC_EAS_PROJECT_ID`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_GUIDELINES_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL`, the Sentry variables above and the secret `GOOGLE_MAPS_ANDROID_API_KEY`. The production profile builds an Android app bundle (`app-bundle`) and an iOS build on the `m-medium` resource class. The development profile needs `EXPO_PUBLIC_EMULATOR_HOST` set to the PC's LAN IP for physical phones.

## Expo Plan 5 data backfill runbook

Run in this order against the production project (always `--project <id>` or `FIREBASE_PROJECT`; the tool refuses to run without one, ignores `GOOGLE_CLOUD_PROJECT`, and is a dry run unless `--apply` is passed):

0. **REQUIRED emulator rehearsal before any production `--apply`.** Start the emulator (`npx firebase-tools emulators:start --only firestore --project demo-echoes`), seed legacy docs (memories without `moderation`, string `releaseDate`, member docs without `userId`, an institution with `adminUserIds`), then with `FIRESTORE_EMULATOR_HOST` set: run each task as a dry run, then with `--apply`, then re-run with `--apply` and expect `changed=0` everywhere.
1. Deploy indexes: `npx firebase deploy --only firestore:indexes --project <id>`; wait for them to build.
2. Deploy functions (with `EXPO_ACCESS_TOKEN=...` in the gitignored `functions/.env.<projectId>`).
3. Dry run: `node functions/tools/backfill.js all --project <id>` and read the per-task summary (`invalid=` counts `releaseDate` strings that are not strict ISO 8601 with a zone, e.g. `2027-01-02T03:04:05Z`; they are left untouched for manual review).
4. Release the client (approved and live in both stores). The legacy Flutter client is locked out by the new rules, so this comes before them.
5. Deploy rules: `npm run deploy:rules -- --project <id>` then `git checkout firestore.rules`. Then straight away: `node functions/tools/backfill.js all --apply --project <id>` (moderation, releaseDate, member `userId`; until it runs, memories without `moderation` are hidden and string `releaseDate` memories never notify).
6. `node functions/tools/backfill.js migrateInstitutionAdmins --apply --project <id>` (copies `adminUserIds` into `admins/{uid}` and deletes the field). Dry run it first. An institution changed concurrently is reported `failed=` (exit code 1); re-run to retry it.
7. Optional cleanup: `node functions/tools/backfill.js deleteLegacyNotificationRequests --apply --project <id>`.
8. **Follow-up (C11):** once a `migrateInstitutionAdmins` dry run shows `changed=0`, ship a change that drops the legacy `adminUserIds` fallback in `functions/institutions.js` and the cleanup `arrayRemove`.

Cost: each task is a full collection scan (reads = documents scanned); `all` scans `memories` twice and `members` once. Every updated memory fires `onMemoryWritten` once, so a large `--apply` produces that many function invocations and aggregate recomputes; run off-peak. `--resume-after <doc path>` (single task only, path must be in that task collection) continues an interrupted run; every task is idempotent, so a plain re-run also works. No member-count backfill exists: `rollupMemberCounts` derives `memberCount` from a `count()` of `members`.

## Expo Plan 4 push and AR runbook

- **EAS credentials:** the owner runs `npx eas-cli init` in `mobile/` and sets `EXPO_PUBLIC_EAS_PROJECT_ID` (local `.env` and EAS environment variables). Configure Android FCM credentials (upload the Firebase service account key / `google-services.json` through `eas credentials`) and iOS APNs credentials (EAS manages the key with an Apple Developer account). Without them Expo Push cannot deliver to physical devices.
- **Expo Push:** `functions/push.js` sends via the Expo push API. Put `EXPO_ACCESS_TOKEN=...` in `functions/.env.<projectId>` (Expo account token) to authenticate requests; it is required at launch (enhanced push security). Token docs must match `ExponentPushToken[...]`/`ExpoPushToken[...]` (enforced by rules) and a user keeps at most 10 tokens. Sends go to at most the 10 most recently seen tokens per user, in chunks of 100; `DeviceNotRegistered` tickets prune the token. `checkPushReceipts` (every 30 minutes) polls receipts for ok tickets and prunes tokens reported `DeviceNotRegistered`.
- **Index deploy:** run `npx firebase deploy --only firestore:indexes --project <project-id>` before shipping. `firestore.indexes.json` includes the `pushTokens.token` collection-group field override that `onPushTokenCreated` uses to dedupe a token across users on shared phones.
- **Deploy functions** (`onNotificationCreated`, `onPushTokenCreated`) together with the indexes.
- **ARCore/ARKit device matrix:** test on at least one ARCore-supported Android device, one non-ARCore Android device, one ARKit iPhone (iOS 15+) and, if possible, a low-end device. Record radar behaviour (orbs, compass heading, 4 s north-up fallback) and, once camera AR is enabled, camera scene, FPS (30 or better) and the fallback to radar.
- **Viro compatibility gate:** `@reactvision/react-viro` currently fails to install on Expo SDK 58 / RN 0.88 (ERESOLVE), so the radar is the shipping AR experience. Before enabling camera AR in a release, install a compatible viro version, verify its API usage and config-plugin options (unverified today), and complete the camera AR device matrix above. Do not ship camera AR on the strength of mocks alone.
