# ECHOES Expo Plan 4 — Development Build, Push Notifications, AR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every task is TDD: superpowers:test-driven-development.

**Goal:** ECHOES builds as an EAS development or store app that delivers inbox notifications as push messages and lets people explore nearby auras and memories in camera AR. A 2D radar fallback works everywhere, including Expo Go.

**Architecture:**
- EAS profiles with fixed app identifiers (ADR-0009).
- Push: client token registry plus a server function that forwards each inbox document to the Expo Push Service.
- AR: the Dart scene mapper is ported with golden fixtures. A heading service feeds a renderer-agnostic `useArScene` hook. The hook drives either the native ViroReact scene (dynamically required) or the radar view (ADR-0010).

**Tech Stack:** Expo SDK 58 + EAS (eas.json), expo-notifications, expo-device, expo-location heading, @reactvision/react-viro (Expo config plugin), react-native-svg, firebase-functions v7 (`onDocumentCreated`), Jest + RNTL 14.

**Spec:** `docs/superpowers/specs/2026-10-18-expo-rewrite-design.md` ("Plan 4 decisions") + `docs/adr/0009-dev-build-and-push.md` + `docs/adr/0010-ar-with-fallback.md`.

## Global Constraints

- All Plan 1–3 Global Constraints apply. No Claude attribution and no `Co-Authored-By` trailer. Branch `expo-rewrite`.
- Copy is verbatim from "Plan 4 decisions". Shared copy goes in `mobile/src/ui/copy.ts` or `data/errors.ts`.
- **Expo Go must keep working.**
  - Native-only modules (`expo-notifications` remote token, `@reactvision/react-viro`) are imported only behind runtime guards in `src/device/*`. Missing modules degrade to the documented fallback copy.
  - `npx expo export` for android and ios must succeed.
- Rules are edited only in `firestore.rules.template`, then regenerated with `node scripts/build-rules.js` and covered by rules tests.
- Server push uses `fetch` against `https://exp.host/--/api/v2/push/send`. `fetch` is injectable for tests. Chunks of ≤ 100 messages. No new npm dependency unless justified in the report.
- Tests must be order-independent and pristine. RNTL 14: always `await`.

## Review Focus

1. **Expo Go and simulators.**
   - Push registration never throws and shows `Push notifications need the ECHOES app build.`
   - The AR screen shows the radar with the unsupported copy.
   - Pinned in Task 4 (`push is unavailable in Expo Go`) and Task 6 (`falls back to radar when AR module is missing`).
2. **Invalid push tokens are pruned and never retried forever.** Pinned in Task 3 (`removes tokens reported DeviceNotRegistered`).
3. **Sign-out removes this device's token, so the next user on a shared phone doesn't get the previous user's pushes.** Pinned in Task 4 (`sign-out unregisters the device token`).
4. **Compass heading wraps 359°→0° without the radar spinning, and a missing magnetometer leaves a static north-up radar with the heading copy.** Pinned in Task 5 (`heading wraps without jumping`, `no compass keeps north up`).
5. **Places exactly at the origin, or more than 24 scene units away, are clamped, never NaN.** Pinned in Task 1 (fixtures `origin` and `far`).

---

### Task 1: AR scene domain (golden fixtures from Dart)

**Files:**
- Create `test/tool/export_ar_fixtures_test.dart` (Flutter exporter). It writes `fixtures/domain/ar_scene.json`.
- Create `mobile/src/domain/arScene.ts` and its test.

**Interfaces — Produces:**
- `mapArScene(origin: LatLng, places: Place[], opts?: { maxPlaces=5; maxOrbsPerPlace=8; metersPerSceneUnit=12; maxSceneDistance=24 }): ArScenePlace[]`.
- `ArScenePlace` is `{ placeId; eastMeters; northMeters; distanceMeters; bearingDegrees; sceneX; sceneZ; auraRadius; auraOpacity; visibleOrbCount }`. It is sorted by distance and limited to `maxPlaces`.
- `rotateByHeading(p: { sceneX; sceneZ }, headingDegrees): { x; z }`. Rotates so the device heading is "forward" (−z).
- `smoothHeading(prev: number | null, next: number, alpha = 0.2): number`. Shortest-arc smoothing; it wraps 359→0.

- [x] **Step 1: Write the Dart exporter.** It covers at least 10 cases with the real `ArSceneMapper`:
  - `origin`: a place at the same point;
  - `far`: 5 km away, clamped;
  - each cardinal direction;
  - more than 5 places, so they are trimmed;
  - intensity 0 and 1;
  - publicMemoryCount 20, capped at 8.
  - Run `flutter test test/tool/export_ar_fixtures_test.dart`.
- [x] **Step 2: Write failing TS tests.**
  - `it.each(fixtures)` with `toBeCloseTo(_, 10)`.
  - `rotateByHeading`: heading 90 maps east to forward.
  - `smoothHeading(350, 10)` moves toward 10 across 0, not via 180, and the result stays in [0, 360).
  - No NaN for the origin case.
- [x] **Step 3: Implement.** **Step 4:** Run the gates.
- [x] **Step 5: Commit** `feat(domain): AR scene mapping ported with golden fixtures`.

---

### Task 2: EAS configuration and app identity

**Files:**
- Create `mobile/eas.json`.
- Modify `mobile/app.config.ts`, `mobile/.env.example`, `README.md` (an "EAS builds" section).
- Create `mobile/test/appConfig.test.ts`.

**Behaviour:**
- `eas.json` profiles:
  - `development`: `developmentClient: true`, `distribution: internal`, env `EXPO_PUBLIC_BACKEND=emulator`.
  - `preview`: `distribution: internal`, android `buildType: apk`.
  - `production`: `autoIncrement: true`.
- `app.config.ts` sets:
  - `android.package` `com.phantom.echoes` and `ios.bundleIdentifier` `com.mrnk2107.echoes`;
  - `extra.eas.projectId` from `EXPO_PUBLIC_EAS_PROJECT_ID`;
  - plugins: `expo-notifications` (Android icon and color) and `@reactvision/react-viro`, the latter only if resolvable (wrap in try/require so `expo export` works before install);
  - the iOS camera usage string `ECHOES uses the camera to show memories around you in AR.`;
  - Android permissions for camera and notifications.
- Install with `npx expo install expo-notifications expo-device` and `npx expo install @reactvision/react-viro`. If the latter isn't compatible with SDK 58, report it and keep the guarded plugin.

- [x] **Step 1: Write failing tests** that evaluate the config function with env stubs: ids, plugins present, the camera string, projectId passthrough, and a missing projectId leading to no `extra.eas`.
- [x] **Step 2–4:** FAIL → implement → PASS. Run the android and ios `expo export`.
- [x] **Step 5: Commit** `build(mobile): EAS profiles and app identity`.

---

### Task 3: Push tokens — rules and server delivery

**Files:**
- Modify `firestore.rules.template` and regenerate.
- Modify `rules_test/*`.
- Create `functions/push.js` and its test, and modify `functions/index.js`.

**Behaviour:**
- Rules for `users/{uid}/pushTokens/{tokenId}`:
  - owner read, create and delete;
  - update only `lastSeenAt`;
  - exact shape `{token: string ≤ 256, platform in ['ios','android'], createdAt: string, lastSeenAt: string}`.
- `onNotificationCreated = onDocumentCreated('users/{uid}/notifications/{id}')`:
  - Load the push tokens and build messages `{ to, title, body, data: { type, ...data }, sound: 'default' }`.
  - POST them in chunks of 100 with an injectable `fetch`.
  - Delete token docs whose ticket has `details.error === 'DeviceNotRegistered'`.
  - Log, and never throw, on HTTP or network errors.
- `cleanupDeletedUser` already recursively deletes `users/{uid}`, including this subcollection; verify with a test.

- [x] **Step 1: Write failing tests:**
  - rules: owner allowed, stranger denied, a bad shape denied, a lastSeenAt-only update allowed;
  - functions: 230 tokens are sent in 3 chunks; **`removes tokens reported DeviceNotRegistered`**; a fetch failure is logged and doesn't throw; no tokens means no fetch.
- [x] **Step 2–4:** FAIL → implement → PASS (functions, rules and emulator gates).
- [x] **Step 5: Commit** `feat(functions): deliver inbox notifications as Expo push`.

---

### Task 4: Client push — registration, settings, tap routing

**Files:**
- Create `mobile/src/device/{push,expoPush}.ts` (+ fake) and `mobile/src/data/{memory,firestore}/pushTokens.ts` with a contract.
- Create `mobile/src/features/inbox/routeForNotification.ts`, extracting the routing from `InboxScreen` and reusing it.
- Modify `ProfileScreen` (push button and states), `(app)/_layout.tsx` (response listener, sign-out unregister) and `features/auth/*` (sign-out path).

**Interfaces:**
- `PushService { availability(): 'available' | 'expo-go' | 'simulator'; permission(): Promise<'granted'|'denied'|'undetermined'>; request(): Promise<'granted'|'denied'>; token(): Promise<string | null>; onResponse(cb: (data: Record<string,string>) => void): () => void; openSettings(): Promise<void> }`.
- `PushTokenRepository { register(uid, token, platform, at): Promise<void>; unregister(uid, token): Promise<void> }`, keyed by `tokenId` (SHA-256 via `expo-crypto`).

**Behaviour:**
- The Profile button shows each state's copy.
- When permission is granted, the app registers on every sign-in and on `lastSeenAt` refresh at most daily.
- Sign-out unregisters the device token before `auth.signOut()`, with a best-effort timeout.
- Tapping a notification calls `router.push(routeForNotification(data))`.

- [x] **Step 1: Write failing tests:**
  - **`push is unavailable in Expo Go`** (fake availability shows the copy and no request);
  - grant leads to register; denied shows the blocked copy and `Open settings` calls `openSettings`;
  - **`sign-out unregisters the device token`**;
  - a tap response routes per type;
  - repository contract on both backends, plus the emulator.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(push): register devices, settings and tap routing`.

---

### Task 5: Heading and AR capability services

**Files:**
- Modify `mobile/src/device/{types,fakes}.ts`.
- Create `mobile/src/device/{expoHeading,arRenderer}.ts` and wire them into `Services`.

**Interfaces:**
- `HeadingService { subscribe(cb: (degrees: number) => void): Promise<() => void> }`. It rejects or returns null when unavailable.
- `ArRenderer { status(): Promise<'available' | 'missing' | 'unsupported'>; requestCamera(): Promise<'granted'|'denied'>; Scene: React.ComponentType<ArSceneProps> | null }`. The dynamic `require('@reactvision/react-viro')` sits inside try/catch, and `ViroUtils.isARSupportedOnDevice` is used when present.
- Fakes: `fakeHeading(values | 'unavailable')` and `fakeArRenderer(status)`.

- [x] **Step 1: Write failing tests:**
  - fakes;
  - the renderer reports `missing` when the require throws (jest mock);
  - **`heading wraps without jumping`** (through `smoothHeading` in a small `useHeading` hook);
  - **`no compass keeps north up`** (hook returns 0 plus `unavailable: true`).
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(device): heading and AR capability services`.

---

### Task 6: AR screen — radar fallback and scene hook

**Files:**
- Create `mobile/src/features/ar/{useArScene,ArRadarView,ArScreen}.tsx` and their tests, and `mobile/app/(app)/ar.tsx`.
- Modify `MapScreen` (`AR` button).

**Behaviour:**
- `useArScene` combines:
  - nearby places within 1000 m (reuse the `useNearbyPlaces` logic or the repo directly);
  - visible memories for the top places, capped at 8 per place, with the blocked filter and readiness gating;
  - the heading and `mapArScene`.
- `ArRadarView` uses SVG:
  - rings at 250, 500 and 1000 m;
  - places at their bearing relative to the heading, with the aura colour and an intensity-scaled radius;
  - orb dots per place;
  - tap targets with accessibility labels `{place name}, {distance}` and `Memory: {first 40 chars}`.
- `ArScreen` picks the mode:
  - renderer `available` and camera granted → camera AR (Task 7 component);
  - otherwise radar plus the matching copy;
  - the toggle `Radar view` / `Camera view` appears only when AR is available;
  - empty copy when there are no places.
- Taps go to `/place/{id}` and `/memory/{id}`.

- [x] **Step 1: Write failing tests:**
  - **`falls back to radar when AR module is missing`** (unsupported copy);
  - camera denied shows the camera copy and the radar;
  - empty state;
  - heading rotates marker positions;
  - blocked authors' orbs are hidden until the blocks are ready;
  - taps navigate.
- [x] **Step 2–4:** FAIL → implement → PASS (+ android export).
- [x] **Step 5: Commit** `feat(ar): radar view and AR screen with fallback`.

---

### Task 7: Native AR scene (ViroReact)

**Files:** Create `mobile/src/features/ar/ViroArScene.tsx` (it uses only the `Scene` export obtained through `ArRenderer`, with no static import of viro) and its test using a jest mock of the module.

**Behaviour:**
- `ViroARSceneNavigator` with an initial scene.
- Per `ArScenePlace`:
  - a `ViroSphere` at `(sceneX, -1, sceneZ)` (rotated by the heading at scene start), with radius `auraRadius`, the aura colour, and opacity `auraOpacity`;
  - up to `visibleOrbCount` small spheres orbiting at radius `auraRadius + 0.6`, evenly spaced, that call `onPressOrb(memoryId)`.
- Pressing the aura calls `onPressPlace(placeId)`.
- Tracking errors switch to radar with the unsupported copy.

- [x] **Step 1: Write failing tests** with a jest mock of `@reactvision/react-viro`:
  - one sphere per place;
  - orb count capped;
  - press handlers;
  - a tracking-error callback leads to fallback.
- [x] **Step 2–4:** FAIL → implement → PASS (+ android export with the guarded require).
- [x] **Step 5: Commit** `feat(ar): ViroReact camera scene`.

---

### Task 8: Plan 4 verification

**Files:** Modify `status.md` (Plan 4 section on top), `README.md` (EAS development build steps: `npx eas-cli build --profile development --platform android`, install, then `npx expo start --dev-client`; push smoke test; AR device checklist) and `docs/release-readiness.md` (EAS credentials, Expo push, ARCore/ARKit device matrix).

- [ ] **Step 1: Run all gates:**
  - mobile tests three times, plus `--randomize`;
  - typecheck and lint;
  - functions;
  - emulator suite;
  - rules;
  - generated-rules sync;
  - android and ios export.

  All must exit 0.
- [ ] **Step 2: Update `status.md`** with the gate table, the device-only checklist, and known follow-ups: an EAS build needs the owner's Expo account; AR has been validated only on mocks until a device run.
- [ ] **Step 3: Commit** `docs: record Expo Plan 4 verification`.
