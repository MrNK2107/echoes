# ECHOES Expo Plan 5 — Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every task is TDD: superpowers:test-driven-development.

**Goal:** ECHOES can be released to the public stores and survive general use. Moderation resists brigading, the backend stays bounded under load, crashes are visible, the app is accessible and documented for store review and operations, and the Flutter client is gone.

**Architecture:**
- Server hardening lands in focused `functions/` modules with rules changes made only through the template.
- Client fixes reuse the existing `services`/`repos` seams. Crash reporting sits behind a `CrashReporter` device interface (ADR-0011).
- E2E is Maestro flows linted by Jest (ADR-0012).
- Operations and store material are docs derived from what the code actually collects.
- Deleting the Flutter client is the last code change.

**Tech Stack:** Expo SDK 58 / RN 0.88, firebase-functions v7 (`onSchedule`, `setGlobalOptions`), `@sentry/react-native` (+ `@sentry/react-native/expo` plugin), `yaml` (devDependency), Maestro, Jest + RNTL 14, `node --test`, rules emulator.

**Spec:** `docs/superpowers/specs/2026-10-18-expo-rewrite-design.md` ("Plan 5 decisions") + `docs/adr/0011-crash-and-error-reporting.md` + `docs/adr/0012-e2e-with-maestro.md`. Backlog: `docs/superpowers/plan5-backlog.md` (each item maps to a task below or to "Deferred" in the spec).

## Global Constraints

- All Plan 1–4 Global Constraints apply. Branch `expo-rewrite`. Never push.
- **No Claude attribution and no `Co-Authored-By` trailer in any commit.**
- TDD: failing test first, then code, then green; tests order-independent and pristine; RNTL 14 always `await`.
- **Expo Go must keep working.** Sentry, notifications and viro load only behind runtime guards. `npx expo export` for android and ios must succeed after every client task.
- Copy is verbatim from "Plan 5 decisions" and single-sourced in `mobile/src/ui/copy.ts` (or `data/errors.ts`).
- Rules are edited only in `firestore.rules.template`, regenerated with `node scripts/build-rules.js`, and covered by `rules_test`. Index changes go in `firestore.indexes.json` with a `rules_test/indexes.test.js` assertion.
- Every server change has a matching memory-backend emulation in `mobile/src/data/memory/*` when the client can observe it.
- Everything is testable on Windows with Jest, `node --test` and the emulators. Steps that need device runs or external accounts (EAS credentials, store consoles, Sentry project, Maestro on a device, legal text) are owner gates written into `docs/release-readiness.md`. Never fake or tick them.
- No new npm dependency beyond `@sentry/react-native` (mobile) and `yaml` (mobile dev).

## Review Focus

1. **Legacy and partially migrated data.** These must never crash or hide content wrongly: memories without `moderation`, a string `releaseDate`, member docs without `userId`, institutions that still have `adminUserIds`, notifications without `actorId`. Pinned in Task 13 (`backfill is idempotent and dry-run writes nothing`) and Task 2 (`notification without actorId is kept`).
2. **Expo Go and tests run without a Sentry DSN.** No module load, no network, no warnings. Pinned in Task 10 (`noop reporter when DSN missing or in Expo Go`).
3. **Unverified accounts cannot brigade.** Three unverified reporters never hide a memory, but a verified third reporter does even after unverified ones. Pinned in Task 1 (`unverified reporters never hide`).
4. **Scheduled jobs stay bounded.** Each run does bounded work and is safe to re-run or overlap: receipts, released tags, rollups. Pinned in Task 2 (`overlapping windows notify once`), Task 4 (`rollup is idempotent`) and Task 5 (`processes at most 1000 receipts per run`).
5. **Large fonts and a 320 dp width.** The map top row and the AR back button stay reachable and labelled. Pinned in Task 7 (`top row collapses at 320dp / fontScale 2`).

---

### Task 1: Moderation hardening (functions)

**Files:**
- Modify `functions/safety.js`, `functions/lib/visibility.js`, `functions/index.js`.
- Modify `functions/test/{safety,visibility}.test.js`.
- Modify `mobile/src/data/memory/safety.ts` and `mobile/src/data/{types,firestore/safety}.ts`.

**Interfaces — Produces:**
- Callable `reportContent({ targetType: 'community'|'profile', targetId, reason, note? })`. Errors:
  - `already-exists` when already reported;
  - `failed-precondition` when the target is missing or is your own profile;
  - `resource-exhausted` (shared `reportMemory` budget).
- `SafetyRepository.reportContent(input: { targetType: 'community' | 'profile'; targetId: string; reason: ReportReason; note: string | null }): Promise<void>`. It rejects with `REPORT_DUPLICATE`, `REPORT_RATE` or `TIMEOUT_ERROR`.
- `canReadMemory(memory, { viewerId, viewerIsCommunityMember, now }): boolean` in `functions/lib/visibility.js`.

- [x] **Step 1: Write failing tests:**
  - `unverified reporters never hide`: 3 reports with `request.auth.token.email_verified=false` leave `moderation` null, and each report doc has `reporterVerified:false`.
  - 2 unverified reports plus 3 verified reports hide on the 3rd verified one, exactly once.
  - `reportContent` community and profile write the doc shape from the spec, reject duplicates and self-profile, and share the 20/day budget with `reportMemory`.
  - `canReadMemory` is true for the author on a hidden or deleted memory and otherwise equals `isVisibleMemory`.
  - The memory backend mirrors this (`store.emailVerified`).
- [x] **Step 2–4:** FAIL → implement (read `request.auth.token.email_verified` in the handler) → PASS (functions and mobile Jest).
- [x] **Step 5: Commit** `feat(functions): verified-reporter auto-hide and reporting communities and profiles`.

---

### Task 2: Notification hygiene (functions)

**Files:**
- Modify `functions/lib/notify.js`, `functions/communities.js`, `functions/tags.js`, `functions/accountCleanup.js`, `functions/index.js`.
- Modify `firestore.indexes.json` (`notifications.actorId` collection-group override; composite `memories (privacy ASC, releaseDate ASC)`).
- Modify the matching tests and `rules_test/indexes.test.js`.
- Modify `mobile/src/domain/types.ts` (`AppNotification.actorId: string | null`), `mobile/src/data/mappers.ts` and `mobile/src/data/memory/notify.ts`.

**Interfaces — Produces:**
- Notification docs gain `actorId: string | null`.
- `notifyReleasedTags = onSchedule('every 60 minutes')`, built from `releasedTagsHandler(db, now)`: it pages through `memories` where `privacy == 'timeRelease'` and `releaseDate` is in `(now − 2 h, now]`, 200 per page, and calls `notifyTaggedUsers`. `taggedUsersCanRead` accepts released `timeRelease`.
- `deleteNotificationsFrom(db, uid)` in `accountCleanup.js` uses a paged collection-group delete.
- The invite id is `communityInvite_${communityId}_${to}_${yyyymmdd}`.

- [x] **Step 1: Write failing tests:**
  - notify writes `actorId`;
  - cleanup deletes other users' notifications whose `actorId` is the deleted uid, and `notification without actorId is kept`;
  - re-invite on the next UTC day creates a second notification, and the same day reports `duplicate`;
  - released tags notify once, `overlapping windows notify once`, unreleased ones are skipped, and hidden or deleted ones are skipped;
  - the mapper reads a missing `actorId` as null;
  - the indexes test lists both new indexes.
- [x] **Step 2–4:** FAIL → implement → PASS (functions, mobile and rules gates).
- [x] **Step 5: Commit** `feat(functions): actor-linked notifications, daily re-invites, released tag notifications`.

---

### Task 3: Rules privacy — profile listing limit, private institution admins, production rules flag

**Files:**
- Modify `firestore.rules.template`, `scripts/build-rules.js`, root `package.json` (`deploy:rules` → `node scripts/build-rules.js --prod && …`).
- Modify `rules_test/{firestore.rules,build-rules}.test.js`.
- Modify `functions/institutions.js` and `functions/accountCleanup.js`, plus their tests.
- Modify `mobile/src/data/firestore/{profiles,institutions}.ts`, `mobile/src/data/memory/institutions.ts`, `mobile/src/domain/types.ts` (drop `Institution.adminUserIds`), `mobile/src/data/mappers.ts` and `mobile/src/features/institutions/InstitutionScreen.tsx`.

**Interfaces — Produces:**
- `InstitutionRepository.subscribeIsAdmin(institutionId: string, uid: string, cb: (isAdmin: boolean) => void, onError?): Unsubscribe`.
- Rules for `publicProfiles`: `allow get: if signedIn(); allow list: if signedIn() && request.query.limit <= 30`.
- Rules for `institutions/{id}/admins/{uid}`: read if `isSelf(uid)`; write false.
- `build-rules.js --prod` writes only `firestore.rules`. It requires `FIREBASE_STORAGE_BUCKET` and emits no `127.0.0.1` or `localhost` hosts.

- [x] **Step 1: Write failing tests:**
  - rules: a list without a limit is denied, `limit(31)` is denied, `limit(30)` is allowed, and get is allowed; admins doc self-read is allowed and others are denied;
  - build-rules: `--prod` output has no loopback and fails without a bucket;
  - functions: a claim writes `admins/{uid}` `{ userId, since }` and not `adminUserIds`, sub-zone admin check reads the admins doc, and cleanup deletes admins docs (collection group `admins` where `userId == uid`; add the field override and its index test);
  - client: `getMany` queries pass `limit(chunk.length)`, and the InstitutionScreen admin UI follows `subscribeIsAdmin` in both backends (contract).
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(rules): bounded profile listing, private institution admins, production rules flag`.

---

### Task 4: Hot documents and function limits

**Files:**
- Create `functions/memberCounts.js` and `functions/test/memberCounts.test.js`.
- Modify `functions/onMemoryWritten.js`, `functions/communities.js`, `functions/index.js` and `firestore.indexes.json` (collection-group `counterShards.updatedAt` override).
- Modify `mobile/src/data/memory/{communities,autoCommunities}.ts`.

**Interfaces — Produces:**
- `isShardedCommunity(id: string): boolean`, which matches `/^(time|era)-/`.
- `SHARDS = 10`.
- `incrementMemberCount(writer: Transaction | WriteBatch, communityRef, delta: 1 | -1, rand = Math.random): void`. It writes shard `floor(rand·10)` with `{ count: increment(delta), updatedAt }` for sharded ids; otherwise it increments `memberCount` directly.
- `rollupMemberCounts = onSchedule('every 10 minutes')`, built from `rollupHandler(db, now)`: it sums the shards of communities whose shards changed in the last 15 min and sets `memberCount`.
- `index.js` calls `setGlobalOptions({ maxInstances: 50 })` before the exports.

- [x] **Step 1: Write failing tests:**
  - the year-community auto-join writes a shard, not the community doc;
  - join and leave on `time-2026` use shards, and on a thematic community they increment directly;
  - `rollup is idempotent` (two runs give the same `memberCount`);
  - rollup ignores shards older than 15 min;
  - the memory backend keeps `memberCount` exact (no lag in demo mode).
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(functions): sharded member counts for auto communities and instance caps`.

---

### Task 5: Push leftovers (server and client)

**Files:**
- Modify `functions/push.js`, `functions/index.js`, `functions/test/push.test.js` and `firestore.rules.template` (`pushReceipts` server-only).
- Modify `mobile/src/features/push/{pushDevice,PushBridge}.ts(x)` and their tests.
- Modify `docs/adr/0009-dev-build-and-push.md` (token squatting note).

**Interfaces — Produces:**
- `PUSH_BODIES: Record<NotificationType, string>` (spec copy). Messages use `PUSH_BODIES[type]` and the doc title.
- `checkPushReceipts = onSchedule('every 30 minutes')`, built from `receiptsHandler(db, fetchImpl, now)`. Receipt URL `https://exp.host/--/api/v2/push/getReceipts`, chunks of 300, ≤ 1000 per run, same `EXPO_ACCESS_TOKEN` header.
- Client: `REGISTER_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000`. `registerDevice` skips when the last success for this uid is newer than that and permission is unchanged. A failed registration subscribes once to `services.device.network` and retries on the first online event.

- [x] **Step 1: Write failing tests:**
  - functions:
    - the push body for `communityInvite` is generic and contains no community name;
    - ok tickets write `pushReceipts` with `expireAt`;
    - a receipt `DeviceNotRegistered` deletes the token and the receipt doc;
    - `processes at most 1000 receipts per run`;
    - a fetch failure keeps the receipt docs;
    - `onPushTokenCreated` wrapper relays to the handler with the trimmed token (the backlog's wrapper test).
  - client: three foreground events within 6 h register once; an offline failure retries when the network comes back; sign-out cancels a pending retry.
- [x] **Step 2–4:** FAIL → implement → PASS (+ rules gate).
- [x] **Step 5: Add an ADR-0009 "Token squatting" note.** A client can register another device's token under its own uid. The impact is limited to receiving that device's pushes for the squatter's own inbox. The fix is the dedupe in `onPushTokenCreated` plus enhanced push security.
- [x] **Step 6: Commit** `feat(push): generic lock-screen text, receipt polling, throttled and offline-retried registration`.

---

### Task 6: Client safety surfaces

**Files:**
- Create `mobile/src/features/safety/BlocksProvider.tsx` (+ test).
- Modify `mobile/src/features/safety/{useBlocks,ReportSheet}.ts(x)`, `mobile/app/(app)/_layout.tsx`, `CommunityScreen.tsx`, `MemoryDetailScreen.tsx`, `InboxScreen.tsx` and `mobile/src/ui/copy.ts`.
- Create `mobile/src/features/transfers/TransferSheet.test.tsx`.

**Interfaces:**
- Consumes `SafetyRepository.reportContent` (Task 1) and `AppNotification.actorId` (Task 2).
- `ReportSheet` props become `{ visible; target: { type: 'memory' | 'community' | 'profile'; id: string }; onClose; onReported }`.
- `BlocksProvider({ children })`; `useBlocksState()` reads its context and throws outside the provider.

- [x] **Step 1: Write failing tests:**
  - `Report community` opens the sheet and calls `reportContent`;
  - `Report {name}` on a non-author memory reports the profile, and a duplicate shows `You already reported this.`;
  - the inbox hides a blocked actor's items and keeps items with a null `actorId`;
  - a membership load error shows `Couldn't check your membership.` and `Retry` and never `Join`;
  - screens share one blocks subscription (repo spy called once with two screens mounted);
  - the TransferSheet remove label.
- [x] **Step 2–4:** FAIL → implement → PASS (+ android export).
- [x] **Step 5: Commit** `feat(safety): report communities and profiles, shared blocks provider, inbox block filter`.

---

### Task 7: Accessibility and layout pass

**Files:**
- Create `mobile/src/ui/Notice.tsx` (+ test).
- Modify `mobile/app/_layout.tsx` (`SafeAreaProvider`), `MapScreen.tsx`, `ArScreen.tsx`, `ArRadarView.tsx`, `features/ar/orbLayout.ts`, `AuraHistoryChart.tsx`, and every screen that renders ad hoc live-region text (`ArScreen`, `CommunityScreen`, and any `accessibilityLiveRegion` found by grep).

**Interfaces — Produces:**
- `Notice({ message: string | null; tone?: 'info' | 'error' }): JSX.Element | null`. It renders `accessibilityRole="alert"` and `accessibilityLiveRegion="polite"`, and calls `AccessibilityInfo.announceForAccessibility(message)` on iOS when `message` changes.
- `separateOrbs(points: {x: number; y: number}[], minDistance = 12): {x: number; y: number}[]` in `orbLayout.ts`.

- [x] **Step 1: Write failing tests:**
  - Notice announces on iOS only on change, and Android relies on the live region;
  - `top row collapses at 320dp / fontScale 2` (mock `useWindowDimensions`; `Communities` is reachable by accessibilityLabel);
  - the map top row and the AR back button apply the top inset (mock `useSafeAreaInsets` with 47);
  - the chart height is `round(width·9/16)` and axis text uses `theme.textSecondary`;
  - radar ring labels are hidden under 280 px;
  - `separateOrbs` leaves no pair closer than 12 and is deterministic;
  - there are no remaining raw `accessibilityLiveRegion` uses outside `Notice` (grep test).
- [x] **Step 2–4:** FAIL → implement → PASS (+ android and ios export).
- [x] **Step 5: Commit** `feat(a11y): Notice live region, safe areas, compact map row, chart and radar legibility`.

---

### Task 8: Session robustness and layer boundaries

**Files:**
- Create `mobile/src/features/auth/{repairRegistration.ts,FinishSetupScreen.tsx}` (+ tests) and `mobile/app/(app)/finish-setup.tsx`.
- Modify `mobile/app/(app)/_layout.tsx`, `mobile/src/data/firestore/institutions.ts` and `InstitutionScreen.tsx`.
- Move `mobile/src/features/ar/ViroArScene.tsx` (and its test) to `mobile/src/device/ar/ViroArScene.tsx`, and update `src/device/arRenderer.ts`.
- Modify `mobile/eslint.config.js` and `mobile/src/device/arRenderer.test.ts`.

**Interfaces — Produces:**
- `needsRepair(services, session): Promise<boolean>`: true when `users/{uid}` is missing.
- `completeRegistration(services, session, name: string, at: Date): Promise<void>`. It creates the users doc with `acceptedTermsAt` = `at` and the defaults register uses, then `ensureProfile`.
- `TOKEN_REFRESH_MIN_INTERVAL_MS = 60_000`.
- ESLint `no-restricted-imports`: `src/domain/**` may not import `@/data`, `@/device`, `@/services` or `@/features`; `src/data/**` and `src/device/**` may not import `@/features`.

- [ ] **Step 1: Write failing tests:**
  - a session without a users doc is routed to `/finish-setup`, Continue without the terms box shows the terms error, and Continue with the box and a name creates the doc and lands on the map;
  - foregrounding the institution screen twice within 60 s forces one token refresh;
  - the AR support check resolves `unsupported` exactly at 3000 ms and `available` when support answers at 2999 ms (fake timers advancing both sides of the race);
  - `npx eslint .` fails on a deliberate `@/features` import from `src/device` (fixture in a temp file, removed after).
- [ ] **Step 2–4:** FAIL → implement → PASS (+ android export).
- [ ] **Step 5: Commit** `fix(mobile): repair partial registrations, debounce token refresh, enforce layer imports`.

---

### Task 9: Production app configuration

**Files:** Modify `mobile/app.config.ts`, `mobile/eas.json`, `mobile/.env.example` and `mobile/test/appConfig.test.ts`.

**Behaviour:**
- Plugins add `["expo-audio", { microphonePermission: "ECHOES records voice notes for your memories." }]`.
- `android.config.googleMaps.apiKey` comes from `GOOGLE_MAPS_ANDROID_API_KEY`. When the key is absent the block is omitted, not set to an empty string.
- `ios.config.usesNonExemptEncryption = false`.
- `ios.privacyManifests` uses the API categories and reasons from the spec, with `NSPrivacyTracking: false`.
- `eas.json` profile `e2e`: `distribution: internal`, android `buildType: apk`, ios `simulator: true`, env `EXPO_PUBLIC_BACKEND=memory`. Production gets `"ios": { "resourceClass": "m-medium" }` and an Android `app-bundle` build type.

- [ ] **Step 1: Write failing tests:** the microphone string, maps key passthrough and omission, the encryption flag, the privacy-manifest reasons, and the `e2e` profile on memory.
- [ ] **Step 2–4:** FAIL → implement → PASS (+ both exports).
- [ ] **Step 5: Commit** `build(mobile): production config (maps key, microphone, privacy manifest, e2e profile)`.

---

### Task 10: Crash and error reporting (ADR-0011)

**Files:**
- Create `mobile/src/device/crashReporter.ts` (+ test).
- Modify `mobile/src/device/{types,fakes}.ts`, `mobile/src/services/{config,createServices}.ts`, `mobile/app/_layout.tsx` (init plus root `ErrorBoundary` export), `mobile/app.config.ts` (conditional Sentry plugin) and `mobile/.env.example`.
- Install `npx expo install @sentry/react-native`.

**Interfaces — Produces:**
- `CrashReporter { init(): void; captureException(e: unknown, context?: Record<string, string>): void }`.
- `createCrashReporter({ dsn: string | null; appOwnership: string | null; environment: BackendMode; release: string }): CrashReporter`.
- `scrub(event): event` removes query strings, `Expo(nent)?PushToken[…]` and email-shaped substrings.
- `AppConfig.sentryDsn: string | null` comes from `EXPO_PUBLIC_SENTRY_DSN`.

- [ ] **Step 1: Write failing tests:**
  - `noop reporter when DSN missing or in Expo Go` (the jest mock of `@sentry/react-native` is never required);
  - with a DSN, `init` passes `sendDefaultPii:false`, `tracesSampleRate:0.1`, environment and release;
  - scrub removes a token, an email and a `?key=`;
  - the error boundary reports and renders `Something went wrong. Please try again.`;
  - the Sentry plugin is present only with `SENTRY_ORG` and `SENTRY_PROJECT`.
- [ ] **Step 2–4:** FAIL → implement → PASS (+ both exports without a DSN).
- [ ] **Step 5: Commit** `feat(mobile): optional Sentry crash reporting without PII`.

---

### Task 11: Performance budgets

**Files:**
- Create `mobile/scripts/check-bundle-size.js`, `mobile/test/bundleSize.test.ts` and `mobile/test/listenerBudget.test.tsx`.
- Modify `mobile/package.json` (`"check:bundle": "node scripts/check-bundle-size.js dist dist-ios"`).

**Interfaces — Produces:**
- `checkBundleSize(distDirs: string[], maxBytes = 6815744): { ok: boolean; sizes: Record<string, number> }`. It reads each `metadata.json` bundle path. The CLI exits 1 and names the platform when a bundle is over the limit.
- `countingRepos(repos): { repos; open(): number }` (test helper in `listenerBudget.test.tsx`). It wraps every `subscribe*` method and counts the unsubscribes not yet called.

- [ ] **Step 1: Write failing tests:**
  - the bundle checker passes under the limit, fails over it, and fails on a missing metadata file;
  - listener budgets with seeded memory services: Map ≤ 4, Place ≤ 4, Community ≤ 4, AR ≤ 7, and 0 open after unmount.
  - If a screen exceeds its budget, reduce its subscriptions. Never raise a budget without a spec change.
- [ ] **Step 2–4:** FAIL → implement → PASS. Run `npx expo export` for both platforms, then `npm run check:bundle`.
- [ ] **Step 5: Commit** `test(mobile): bundle-size and listener budgets`.

---

### Task 12: Maestro flows (ADR-0012)

**Files:** Create `mobile/.maestro/{config.yaml,sign-in-and-map.yaml,add-memory.yaml,memory-lifecycle.yaml,report-and-block.yaml,communities.yaml,delete-account.yaml}` and `mobile/test/maestroFlows.test.ts`. Add devDependency `yaml`.

**Interfaces — Produces:**
- Flows sign in with `demo@echoes.app` / `echoes-demo`, `setLocation` at the first seeded place, and select only by copy.
- `lintFlow(yamlText: string, sourceText: string): string[]` returns the problems found.

- [ ] **Step 1: Write failing tests:** every flow parses, `appId` is `com.phantom.echoes`, and every selector text is found in `mobile/src` or `mobile/app`; a planted bogus selector is reported.
- [ ] **Step 2–4:** FAIL → write the flows and `lintFlow` → PASS.
- [ ] **Step 5: Commit** `test(e2e): Maestro flows linted against app copy`.

---

### Task 13: Legacy-data backfill tool

**Files:** Create `functions/tools/backfill.js` and `functions/test/backfill.test.js`. Extend `functions/test/fakes/firestore.js` with collection groups if missing.

**Interfaces — Produces:**
- Exports `backfillModeration`, `backfillReleaseDates` (ISO string → Timestamp), `backfillMemberUserIds` (from the doc id), `migrateInstitutionAdmins` (`adminUserIds` → `admins/{uid}`, then the field is deleted) and `deleteLegacyNotificationRequests`.
- Each has the signature `(db, { apply = false, pageSize = 400 }) → Promise<{ scanned: number; changed: number }>`.
- The CLI is `node functions/tools/backfill.js <task> [--apply]` (`--help` lists the tasks) and uses Application Default Credentials.

- [ ] **Step 1: Write failing tests:**
  - `backfill is idempotent and dry-run writes nothing` for each task;
  - an existing `moderation: 'hidden'` is never overwritten;
  - unparsable `releaseDate` strings are counted and left alone.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(functions): legacy data backfill tool`.

---

### Task 14: Store listing, privacy labels and ops runbook

**Files:**
- Create `docs/store/listing.md`, `docs/store/privacy-labels.md` and `docs/ops/runbook.md`.
- Rewrite `docs/release-readiness.md`: Expo gates replace the Flutter gates, and Plan 5 owner gates are added.

**Content (decided):**
- **`privacy-labels.md`.** One table per store, derived from the code:
  - Data collected: email, display name, precise location (memory coordinates; current location used on device only), photos, audio, other user content (text, reports), user ID, device ID (Expo push token), crash logs, diagnostics and performance (Sentry, not linked to identity).
  - Purposes: app functionality and account management; analytics none; tracking none.
  - Processors: Google Firebase, Expo, Sentry.
  - Encrypted in transit; in-app account deletion; retention of 30-day restore and 90-day notifications.
  - Each row cites the source file it was derived from.
- **`listing.md`.** Name, short and full description, category Social, content rating 13+/Teen with user-generated content, support email and URL placeholders, required screenshots list, and an App Review demo account note (a reviewer account on production).
- **`runbook.md`:**
  - deploy order: indexes, wait for them to build, functions, `deploy:rules` (`--prod`), then store release;
  - Firestore PITR and daily scheduled backups (`gcloud firestore backups schedules create --recurrence=daily --retention=14w`), and restore steps;
  - TTL policies for `rateLimits`, `notifications` and `pushReceipts` (`expireAt`);
  - backfill order with dry-run first;
  - legacy Flutter member docs;
  - alerts: function error rate, `checkPushReceipts` failures, Firestore reads per day, and billing budgets at 50/90/100%;
  - quotas and `maxInstances`;
  - Auth email-enumeration protection;
  - moderation (reviewing `reports`, restoring with `moderation: null`, 24 h response target), with incident severity levels and kill switches (disable a function, revoke `EXPO_ACCESS_TOKEN`, roll the rules back to the previous release);
  - Sentry and Expo token rotation.

- [ ] **Step 1: Cross-check** every data type in `privacy-labels.md` against `mobile/src/domain/types.ts`, the `app.config.ts` permissions and `crashReporter.ts`. Record anything found in the code but not in the labels as a defect and fix it.
- [ ] **Step 2: Verify** that each command in the runbook exists (`npm run deploy:rules`, `node functions/tools/backfill.js --help`).
- [ ] **Step 3: Commit** `docs: store listing, privacy labels and ops runbook`.

---

### Task 15: Delete the Flutter client

**Files:**
- Delete (`git rm -r`): `lib/`, `test/` (including the `test/tool/` Dart exporters; the `fixtures/domain/*.json` they produced stay), `integration_test/`, `android/`, `ios/`, `web/`, `linux/`, `macos/`, `windows/`, `pubspec.yaml`, `pubspec.lock`, `analysis_options.yaml`, `.metadata`, `echoes.iml`, root `.env.example` (Flutter-only keys), `implementation_plan.md`, `implementation_plan_v2.md`, `.github/workflows/flutter.yml`.
- Remove the untracked `build/`, `.dart_tool/` and `.flutter-plugins-dependencies` locally.
- Modify `functions/index.js` and `functions/index.test.js` to remove `dispatchNotificationRequest`, `buildMulticastMessage`, `stringifyData`, `safeString` and `pruneInvalidTokens`. Keep the rules deny for `notificationRequests` and the cleanup queries for leftover legacy docs.
- Create `.github/workflows/ci.yml`:
  - backend job: functions, rules and the emulator contract;
  - mobile job: test, typecheck, lint, `expo export` android and ios, `check:bundle`.
- Modify `.gitignore` (drop the Flutter sections, keep the secret patterns), `README.md` (Expo-only: setup, run, EAS, release; the Flutter sections removed) and `docs/adr/0005-testing-strategy.md` (a note that fixtures are now the oracle and the exporters live in git history before this commit).

- [ ] **Step 1: Prove nothing depends on Flutter.** `git grep -nE "pubspec|\.dart\b|integration_test|(^|[^/])lib/features" -- mobile functions rules_test scripts firebase.json package.json` must return only comments that name the historical oracle. `firebase.json` has no hosting entry (verified while planning). Record the grep output in the commit body.
- [ ] **Step 2: Delete** the files and run every gate in Task 16 Step 1. All must exit 0.
- [ ] **Step 3: Commit** `chore: remove the Flutter client and legacy push dispatcher`.

---

### Task 16: Plan 5 verification

**Files:** Modify `status.md` (Plan 5 section on top), `README.md` (launch checklist link) and `docs/release-readiness.md` (owner gates).

- [ ] **Step 1: Run all gates:**
  - mobile Jest three times, plus `--randomize`;
  - typecheck;
  - lint;
  - `npm test` in `functions`;
  - the emulator contract suite;
  - rules tests;
  - `node scripts/build-rules.js` with `git status --porcelain` clean;
  - `FIREBASE_STORAGE_BUCKET=x node scripts/build-rules.js --prod`, with the generated output reverted afterwards;
  - android and ios `expo export`;
  - `npm run check:bundle`.

  All must exit 0.
- [ ] **Step 2: Update `status.md`** with the gate table and the owner-gate checklist. Each gate is unchecked until really done:
  - EAS credentials and production builds;
  - Play Console and App Store Connect listings and labels;
  - legal pages hosted and the `EXPO_PUBLIC_*` URLs set;
  - Sentry project and DSN;
  - `GOOGLE_MAPS_ANDROID_API_KEY`;
  - Maestro run on a device;
  - backfills applied;
  - TTL, PITR, backups and alerts configured;
  - `EXPO_ACCESS_TOKEN` set;
  - device performance measured against the budgets;
  - camera AR still off pending viro.
- [ ] **Step 3: Commit** `docs: record Expo Plan 5 verification`.
