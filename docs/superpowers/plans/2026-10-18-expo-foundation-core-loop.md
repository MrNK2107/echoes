# ECHOES Expo Plan 1 — Foundation + Core Memory Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every task is TDD: superpowers:test-driven-development.

**Goal:** An Expo Go app in `mobile/` where a user signs up/in, sees nearby places with aura-colored markers on a map, opens a place to read the memories they may see, and adds a text/photo memory with public/private/time-release privacy — against seeded in-memory data, the Firebase emulators, or the real project.

**Architecture:** Pure TypeScript domain ported from Dart and pinned by golden fixtures exported from the Dart code; repository interfaces with in-memory and Firestore implementations sharing one contract test suite; a single composition root selected by `EXPO_PUBLIC_BACKEND`; place aura/counts computed server-side by a new `onMemoryWritten` Cloud Function.

**Tech Stack:** Expo SDK 58, React Native 0.88, TypeScript (strict), expo-router, firebase JS SDK 13, react-native-maps, expo-location, expo-image-picker, expo-image-manipulator, @react-native-async-storage/async-storage, Jest (`jest-expo`), @testing-library/react-native 14, firebase-tools 15, Node 22 functions.

**Spec:** `docs/superpowers/specs/2026-10-18-expo-rewrite-design.md` (+ ADRs `docs/adr/0001`–`0005`)

## Global Constraints

- All new client code lives in `mobile/`; do not modify `lib/`, `test/` (except Task 1's fixture exporter), `android/`, `ios/`.
- Install native-backed packages with `npx expo install <pkg>` (SDK-compatible versions), never plain `npm install`.
- TypeScript `strict: true`; no `any` in `src/domain` or `src/data`.
- Import alias `@/` → `mobile/src/`.
- `src/domain` imports nothing from `react`, `react-native`, `expo-*`, or `firebase`.
- Optional domain fields are `null`, never `undefined` (Firestore cannot store `undefined`).
- Firestore field names and date encodings exactly as the spec's Data contract table: memories use `Timestamp`; places/users/aura use ISO-8601 UTC strings.
- Privacy strings: `public`, `private`, `tagged`, `timeRelease`, `community`.
- Constants: place match radius `100` m, map radius `1500` m, list limit `50`, earth radius `6371000` m, image upload limit `1048576` bytes.
- UI copy strings copied verbatim from the spec's "Validation copy" section.
- Every task ends green on `npm --prefix mobile test`, `npm --prefix mobile run typecheck`, `npm --prefix mobile run lint`.
- Commit messages carry NO Claude attribution (no `Co-Authored-By: Claude` trailer) — user instruction. Work on branch `expo-rewrite` (branched from `hardening-pass`).

## Review Focus

1. **Geohash range upper bound** — the Dart Firestore query used `geohash < prefix + 'z'`, which skips every place whose next geohash char is `z`. Expect such places to appear. Pinned in Task 9 (`finds a place whose geohash continues with z`).
2. **Offline submit hangs** — Firestore JS writes never resolve without a connection; a user on a flaky network must get an error, not an endless spinner. Pinned in Task 15 (`times out after 15 s with a connection error`).
3. **Location denied or unavailable** — the map must show the denied message with a retry, never spin forever. Pinned in Task 13 (`shows denied state` / `shows error when position lookup throws`).
4. **Large or cancelled photo picks** — a 4 MB camera photo must be compressed under 1 MiB; cancelling the picker leaves the form unchanged. Pinned in Task 15 (`compresses until under the upload limit`, `ignores a cancelled pick`).
5. **Legacy memory dates** — older memory docs store ISO strings, not Timestamps; they must still load. Pinned in Task 6 (`reads legacy ISO date strings`).

---

## File Structure

```
fixtures/domain/{sentiment,geohash,nearby,aura,visibility}.json   golden outputs from Dart
test/tool/export_domain_fixtures_test.dart                         Dart exporter (Task 1)
mobile/
  app.config.ts  package.json  tsconfig.json  jest.config.js  jest.setup.ts  eslint.config.js
  app/_layout.tsx  app/sign-in.tsx  app/(app)/_layout.tsx  app/(app)/index.tsx
  app/(app)/place/[id].tsx  app/(app)/add-memory.tsx
  src/domain/{types,privacy,geo,sentiment,sentimentLexicon,aura}.ts
  src/data/types.ts                         repository interfaces
  src/data/mappers.ts                       Firestore <-> domain
  src/data/memory/{store,places,memories,users,auth,media}.ts
  src/data/firestore/{places,memories,users,auth,media}.ts
  src/data/seed.ts
  src/device/{types,expoLocation,expoImagePicker,fakes}.ts
  src/services/{config,firebase,createServices,ServicesProvider}.ts(x)
  src/features/auth/{validators,useSession,SignInScreen}.ts(x)
  src/features/map/{useNearbyPlaces,MapScreen}.ts(x)
  src/features/places/{usePlaceMemories,PlaceScreen,MemoryCard}.tsx
  src/features/memories/{submitMemory,compressImage,AddMemoryScreen}.ts(x)
  src/ui/theme.ts
  test/contracts/*.contract.ts              shared repository contract suites
functions/aura.js  functions/onMemoryWritten.js  functions/test/*.test.js
```

---

### Task 1: Export golden domain fixtures from the Dart code

**Files:**
- Create: `test/tool/export_domain_fixtures_test.dart`
- Create (generated): `fixtures/domain/sentiment.json`, `geohash.json`, `nearby.json`, `aura.json`, `visibility.json`

**Interfaces:**
- Produces the fixture schemas every later domain task reads:
  - `sentiment.json`: `[{ text, compound, positive, neutral, negative, category }]` — `category` = `SentimentCategory.name`.
  - `geohash.json`: `[{ latitude, longitude, precision, hash }]`
  - `nearby.json`: `[{ latitude, longitude, radiusMeters, precision, prefixes: string[] }]` — from `NearbyPlaceQuery.geohashPrecisionFor` and `NearbyPlaceQuery.queryPrefixes`.
  - `aura.json`: `[{ name, now (ISO), memories: [{ compound, createdAt (ISO), isDeleted }], expected: { dominantSentiment, compoundScore, intensity, memoryCount, colorHex } }]`
  - `visibility.json`: `[{ name, memory: { userId, privacy, taggedUserIds, releaseDate (ISO|null), isDeleted }, viewerId, viewerIsCommunityMember, now (ISO), visible }]`

- [x] **Step 1: Write the exporter as a Flutter test** that builds the cases below with the real Dart classes (`LexiconSentimentAnalyzer`, `Geohash.encode`, `NearbyPlaceQuery`, `AuraCalculator`, `Memory.isVisibleTo`), writes pretty JSON to `fixtures/domain/`, and asserts each file has at least the listed number of cases.
  - Sentiment (≥40): plain positive/negative words, negations (`not happy`, `never good`), intensifiers (`very good`, `extremely sad`, `slightly bad`), contrast (`good but sad`, `sad but beautiful`), all-caps, punctuation `!!!`, emoji-only `🎉🎉`, empty-after-trim `"   "`, mixed (`happy and heartbroken`), 2000-char repeated text, Hindi/English mix (`bahut khushi, so happy`), every category at least 3 times.
  - Geohash (≥12): Bengaluru `12.9716,77.5946`, Delhi, Mumbai, `0,0`, `-33.8688,151.2093`, `89.9,179.9`, `-89.9,-179.9`, precisions 5, 7, 9.
  - Nearby (≥8): radii `50, 100, 101, 500, 1500, 4000, 4001, 20000` at Bengaluru.
  - Aura (≥10): empty; one positive today; one heavy 90 days old; positive+negative → mixed; deleted-only → empty; 25 neutral → intensity 1; ages 0/29/30/31/365 days with fractional-day offsets (e.g. 30 days minus 1 hour — Dart `inDays` truncates); compound exactly 0.1, 0.35, −0.35, −0.1.
  - Visibility (≥14): each privacy × (author, stranger), tagged member vs not, timeRelease with releaseDate = now (visible), now − 1 ms (visible), now + 1 ms (hidden), null; community member vs not; deleted author memory (hidden).

- [x] **Step 2: Run it**

Run: `flutter test test/tool/export_domain_fixtures_test.dart`
Expected: PASS; five JSON files exist under `fixtures/domain/`.

- [x] **Step 3: Commit**

```bash
git add test/tool/export_domain_fixtures_test.dart fixtures/domain
git commit -m "test: export golden domain fixtures from Dart implementation"
```

---

### Task 2: Scaffold the Expo app with Jest, lint, typecheck and CI

**Files:**
- Create: `mobile/` via `npx create-expo-app@latest mobile --template blank-typescript` (SDK 58), then `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar`
- Create: `mobile/jest.config.js`, `mobile/jest.setup.ts`, `mobile/app/_layout.tsx`, `mobile/app/(app)/index.tsx` (placeholder), `mobile/src/ui/theme.ts`, `mobile/test/smoke.test.tsx`
- Modify: `mobile/package.json` (`"main": "expo-router/entry"`, scripts), `mobile/tsconfig.json` (strict, `paths: { "@/*": ["src/*"] }`), `.github/workflows/flutter.yml` → add job `mobile`
- Modify: root `.gitignore` (add `mobile/node_modules/`, `mobile/.expo/`, `mobile/dist/`)

**Interfaces:**
- Produces scripts: `test` (`jest`), `test:emulator` (`jest -c jest.emulator.config.js`, config created in Task 9), `typecheck` (`tsc --noEmit`), `lint` (`expo lint`).
- Produces `theme` export in `src/ui/theme.ts`: `colors = { background:'#0D1117', surface:'#161B22', elevated:'#21262D', accent:'#58A6FF', gold:'#F0B429', text:'#F0F6FC', textSecondary:'#8B949E' }`.

- [x] **Step 1: Scaffold and install dev deps:** `npx expo install jest-expo jest @types/jest @testing-library/react-native -- --save-dev`. `jest.config.js`: preset `jest-expo`, `moduleNameMapper` for `^@/(.*)$`, `setupFilesAfterEnv: ['./jest.setup.ts']`, `testPathIgnorePatterns` includes `\\.emulator\\.test\\.ts$`.

- [x] **Step 2: Write the failing smoke test** `test/smoke.test.tsx`: render `app/(app)/index.tsx`'s default export and `expect(screen.getByText('ECHOES')).toBeOnTheScreen()`.

- [x] **Step 3: Run** `npm --prefix mobile test` — Expected: FAIL (text not found).

- [x] **Step 4: Implement** the placeholder screen rendering `ECHOES` on `colors.background`; root `_layout.tsx` renders `<Stack screenOptions={{ headerShown:false }} />`.

- [x] **Step 5: Run** `npm --prefix mobile test && npm --prefix mobile run typecheck && npm --prefix mobile run lint` — Expected: all PASS.

- [x] **Step 6: Add CI job** `mobile` (ubuntu, `actions/setup-node@v5` Node 22, `npm ci` in `mobile`, then test/typecheck/lint).

- [x] **Step 7: Verify the bundle builds without a device:** `cd mobile && npx expo export --platform android --output-dir dist` — Expected: exits 0.

- [x] **Step 8: Commit** `feat(mobile): scaffold Expo SDK 58 app with jest, lint, typecheck, CI`.

---

### Task 3: Domain types and privacy rules

**Files:**
- Create: `mobile/src/domain/types.ts`, `mobile/src/domain/privacy.ts`
- Test: `mobile/src/domain/privacy.test.ts`

**Interfaces:**
- Produces (`types.ts`):
```ts
export type PrivacyType = 'public' | 'private' | 'tagged' | 'timeRelease' | 'community';
export type SentimentCategory = 'positive' | 'peaceful' | 'neutral' | 'mixed' | 'heavy';
export interface LatLng { latitude: number; longitude: number }
export interface SentimentResult { compound: number; positive: number; neutral: number; negative: number }
export interface AuraZone { dominantSentiment: SentimentCategory; compoundScore: number; intensity: number; memoryCount: number; colorHex: string; updatedAt: Date }
export interface Memory { id: string; userId: string; placeId: string; imageUrl: string | null; audioUrl: string | null; textContent: string; latitude: number; longitude: number; geohash: string; sentiment: SentimentResult; privacy: PrivacyType; taggedUserIds: string[]; communityId: string | null; releaseDate: Date | null; isDeleted: boolean; deletedAt: Date | null; createdAt: Date; updatedAt: Date }
export interface Place { id: string; name: string; latitude: number; longitude: number; geohash: string; communityId: string | null; custodianIds: string[]; aura: AuraZone; memoryCount: number; publicMemoryCount: number; createdAt: Date; updatedAt: Date }
export interface AppUser { id: string; displayName: string | null; email: string | null; photoUrl: string | null; defaultPrivacy: PrivacyType; managedPlaceIds: string[]; communityIds: string[]; createdAt: Date; updatedAt: Date }
export interface AuthSession { userId: string; email: string; displayName: string | null }
```
- Produces (`privacy.ts`):
  - `isMemoryVisibleTo(memory: Pick<Memory,'userId'|'privacy'|'taggedUserIds'|'releaseDate'|'isDeleted'>, viewer: { viewerId: string; viewerIsCommunityMember: boolean; now: Date }): boolean`
  - `validatePrivacy(input: { privacy: PrivacyType; taggedUserIds: string[]; releaseDate: Date | null; communityId: string | null; now: Date }): string | null` — returns the spec's privacy error strings.

- [x] **Step 1: Write failing tests:** `it.each(visibility.json)` → `isMemoryVisibleTo(...) === visible` (parse ISO dates); `validatePrivacy` cases: tagged + `[]` → `'Add at least one tagged user.'`; timeRelease + null → `'Choose a release date.'`; timeRelease + releaseDate == now → `'Choose a future release date.'`; community + null → `'Choose a community.'`; public → `null`.
- [x] **Step 2: Run** `npm --prefix mobile test -- privacy` — Expected: FAIL (module not found).
- [x] **Step 3: Implement** both functions per the spec's Visibility rule.
- [x] **Step 4: Run** — Expected: PASS.
- [x] **Step 5: Commit** `feat(domain): port memory types and privacy rules`.

---

### Task 4: Geo — geohash, distance, nearby prefixes

**Files:**
- Create: `mobile/src/domain/geo.ts`
- Test: `mobile/src/domain/geo.test.ts`

**Interfaces:**
- Produces: `encodeGeohash(lat: number, lng: number, precision = 9): string`, `distanceMeters(a: LatLng, b: LatLng): number` (haversine, R = 6371000), `geohashPrecisionFor(radiusMeters: number): number`, `queryPrefixes(origin: LatLng, radiusMeters: number): string[]`, `geohashRangeEnd(prefix: string): string` (= `prefix + ''`).

- [x] **Step 1: Write failing tests:** `it.each(geohash.json)`, `it.each(nearby.json)` (precision and prefixes exactly equal); `distanceMeters({0,0},{1,0})` `toBeCloseTo(111194.93, 1)`; `distanceMeters(p,p) === 0`; `geohashRangeEnd('tdr1')` > `'tdr1zzzz'`.
- [x] **Step 2: Run** `npm --prefix mobile test -- geo` — Expected: FAIL.
- [x] **Step 3: Implement** by porting `lib/core/geo/geohash.dart` and `NearbyPlaceQuery` (`lib/features/places/domain/nearby_place_query.dart`), including its cell-width table and 33-entry neighbour expansion verbatim.
- [x] **Step 4: Run** — Expected: PASS.
- [x] **Step 5: Commit** `feat(domain): port geohash, haversine and nearby prefixes`.

---

### Task 5: Sentiment analyzer

**Files:**
- Create: `mobile/src/domain/sentimentLexicon.ts` (word sets), `mobile/src/domain/sentiment.ts`
- Test: `mobile/src/domain/sentiment.test.ts`

**Interfaces:**
- Produces: `analyzeSentiment(text: string): SentimentResult`, `sentimentCategory(r: SentimentResult): SentimentCategory`.

- [x] **Step 1: Write failing tests:** `it.each(sentiment.json)` — each of `compound/positive/neutral/negative` `toBeCloseTo(expected, 10)` and `sentimentCategory(result) === category`; plus `sentimentCategory({compound:0.5,positive:0.4,neutral:0.2,negative:0.4})` → `'mixed'`.
- [x] **Step 2: Run** `npm --prefix mobile test -- sentiment` — Expected: FAIL.
- [x] **Step 3: Implement** as a line-for-line port of `lib/features/aura/data/lexicon_sentiment_analyzer.dart` (tokenisation, negation window, intensifier factors, `but` weighting, normalisation) — copy every word set verbatim into `sentimentLexicon.ts`. Category thresholds from `sentiment_result.dart`.
- [x] **Step 4: Run** — Expected: PASS for every fixture. A mismatch means the port differs from Dart; fix the port, never the fixture.
- [x] **Step 5: Commit** `feat(domain): port lexicon sentiment analyzer`.

---

### Task 6: Aura calculator and Firestore mappers

**Files:**
- Create: `mobile/src/domain/aura.ts`, `mobile/src/data/mappers.ts`
- Test: `mobile/src/domain/aura.test.ts`, `mobile/src/data/mappers.test.ts`
- Install: `npx expo install firebase`

**Interfaces:**
- Produces (`aura.ts`): `AURA_COLORS: Record<SentimentCategory,string>` (spec hex values), `emptyAura(now: Date): AuraZone`, `calculateAura(memories: Pick<Memory,'sentiment'|'createdAt'|'isDeleted'>[], now: Date): AuraZone`. `ageDays = Math.max(Math.trunc((now - createdAt) / 86_400_000), 0)` (Dart `inDays` truncation). Caller passes public memories only.
- Produces (`mappers.ts`): `memoryToDoc(m: Memory): DocumentData`, `memoryFromDoc(id: string, d: DocumentData): Memory`, `placeToDoc(p: Place)`, `placeFromDoc(id, d)`, `userToDoc(u: AppUser)`, `userFromDoc(id, d)`. Memory dates ↔ `Timestamp`; place/user/aura dates ↔ ISO strings; `toDate(v: Timestamp | string | null | undefined): Date | null` accepts both.

- [x] **Step 1: Write failing tests:** `it.each(aura.json)` (dominantSentiment, colorHex, memoryCount equal; compoundScore/intensity `toBeCloseTo(_,10)`); mappers: `memoryFromDoc(id, memoryToDoc(m))` deep-equals `m`; `memoryToDoc(m).createdAt instanceof Timestamp`; `placeToDoc(p).createdAt === p.createdAt.toISOString()`; `reads legacy ISO date strings` — memory doc with `createdAt: '2025-01-02T03:04:05.000Z'` maps to that Date; missing `imageUrl` maps to `null`.
- [x] **Step 2: Run** `npm --prefix mobile test -- aura mappers` — Expected: FAIL.
- [x] **Step 3: Implement** `aura.ts` from `lib/features/aura/domain/aura_calculator.dart`; mappers per spec Data contract.
- [x] **Step 4: Run** — Expected: PASS.
- [x] **Step 5: Commit** `feat(domain): aura calculator and Firestore mappers`.

---

### Task 7: Repository interfaces, in-memory backend, contract suites

**Files:**
- Create: `mobile/src/data/types.ts`, `mobile/src/data/memory/{store,places,memories,users,auth,media}.ts`
- Create: `mobile/test/contracts/{places,memories,auth}.contract.ts`
- Test: `mobile/src/data/memory/memoryBackend.test.ts`

**Interfaces:**
- Produces (`data/types.ts`):
```ts
export type Unsubscribe = () => void;
export interface PlaceRepository {
  subscribeNearby(q: { center: LatLng; radiusMeters: number }, cb: (places: Place[]) => void, onError?: (e: Error) => void): Unsubscribe;
  findById(id: string): Promise<Place | null>;
  findNearest(q: { center: LatLng; radiusMeters: number }): Promise<Place | null>;
  create(place: Place): Promise<void>;
}
export interface MemoryRepository {
  subscribeVisibleForPlace(q: { placeId: string; viewerId: string; viewerCommunityIds: string[]; now: Date }, cb: (memories: Memory[]) => void, onError?: (e: Error) => void): Unsubscribe; // newest first, ≤ 50
  create(memory: Memory): Promise<void>;
}
export interface UserRepository { get(id: string): Promise<AppUser | null>; create(user: AppUser): Promise<void> }
export interface AuthRepository {
  subscribe(cb: (s: AuthSession | null) => void): Unsubscribe;
  signIn(email: string, password: string): Promise<AuthSession>;
  register(email: string, password: string, displayName: string): Promise<AuthSession>;
  signOut(): Promise<void>;
}
export interface MediaRepository { uploadMemoryImage(input: { userId: string; memoryId: string; localUri: string }): Promise<string> }
export interface Repositories { places: PlaceRepository; memories: MemoryRepository; users: UserRepository; auth: AuthRepository; media: MediaRepository }
```
- Produces: `createMemoryBackend(seed?: { places: Place[]; memories: Memory[]; users: AppUser[] }): Repositories`. On `memories.create`, the in-memory backend recomputes the place exactly as ADR-0003's function does (aura from non-deleted public memories, `memoryCount`, `publicMemoryCount`, `updatedAt`) and notifies place subscribers. `auth.register` with an existing email rejects with `Error('An account already exists for that email.')`; wrong password rejects `Error('Incorrect email or password.')`. `media.uploadMemoryImage` returns `memory://images/{userId}/{memoryId}.jpg`.
- Produces contract suites: `export function placeRepositoryContract(name: string, make: () => Promise<{ repos: Repositories; signInAs(uid: string): Promise<void>; cleanup(): Promise<void> }>)` and likewise `memoryRepositoryContract`, `authRepositoryContract`. Suites must use only the interface.

- [x] **Step 1: Write the contract suites and `memoryBackend.test.ts`** that invokes each with `createMemoryBackend`. Required cases:
  - places: `findNearest` returns the place 60 m away and `null` for 150 m (radius 100); `subscribeNearby` emits places within 1500 m sorted by distance and excludes one 2 km away; emits again after `create`.
  - memories: viewer sees public + own private, not another user's private; tagged visible only to tagged viewer; timeRelease hidden before releaseDate; newest first; at most 50; after `create(public memory)` the place's `memoryCount`, `publicMemoryCount` and `aura.memoryCount` increase by 1 (memory backend: immediately; contract waits with `waitFor` up to 10 s).
  - auth: register → session with displayName; `subscribe` emits it; signOut emits `null`; duplicate register and wrong password reject.
- [x] **Step 2: Run** `npm --prefix mobile test -- memoryBackend` — Expected: FAIL.
- [x] **Step 3: Implement** the in-memory backend over one `store.ts` (Maps + listener sets), reusing `isMemoryVisibleTo`, `distanceMeters`, `calculateAura`.
- [x] **Step 4: Run** — Expected: PASS.
- [x] **Step 5: Commit** `feat(data): repository interfaces, in-memory backend, contract suites`.

---

### Task 8: Demo seed data

**Files:**
- Create: `mobile/src/data/seed.ts`
- Test: `mobile/src/data/seed.test.ts`

**Interfaces:**
- Produces: `DEMO_USER = { email: 'demo@echoes.app', password: 'echoes-demo', displayName: 'Demo Custodian' }`, `buildSeed(now: Date, center: LatLng = { latitude: 12.9716, longitude: 77.5946 }): { places: Place[]; memories: Memory[]; users: AppUser[] }`. The memory backend's auth pre-registers `DEMO_USER` when seeded.

- [x] **Step 1: Write failing tests:** seed has ≥ 6 places within 1500 m of `center`, covering all five aura categories; ≥ 20 memories across all five privacy modes; every place's `aura` equals `calculateAura` of its public memories; `signIn(DEMO_USER.email, DEMO_USER.password)` succeeds on `createMemoryBackend(buildSeed(now))`.
- [x] **Step 2: Run** `npm --prefix mobile test -- seed` — Expected: FAIL.
- [x] **Step 3: Implement** with hand-written memory texts whose analyzed sentiment yields the intended category (use `analyzeSentiment`, not hard-coded scores).
- [x] **Step 4: Run** — Expected: PASS.
- [x] **Step 5: Commit** `feat(data): seeded demo data for memory backend`.

---

### Task 9: Firestore backend + emulator contract run

**Files:**
- Create: `mobile/src/data/firestore/{places,memories,users,auth,media}.ts`, `mobile/src/data/firestore/index.ts`
- Create: `mobile/jest.emulator.config.js`, `mobile/test/firestoreBackend.emulator.test.ts`
- Modify: `firebase.json` — emulators `auth` 9099, `firestore` 8080, `storage` 9199, `functions` 5001 (no `singleProjectMode` — `rules_test` uses its own project id). All mobile emulator commands pass `--project demo-echoes`; add root script note to `README.md` (emulator section).

**Interfaces:**
- Consumes: `Repositories`, mappers, contract suites (Task 7).
- Produces: `createFirestoreBackend(deps: { db: Firestore; auth: Auth; storage: FirebaseStorage }): Repositories`.
  - `subscribeNearby`: one `onSnapshot` per prefix from `queryPrefixes`, `where('geohash','>=',p)`, `where('geohash','<',geohashRangeEnd(p))`, `limit(50)`; merge, de-dupe by id, filter by `distanceMeters ≤ radius`, sort by distance.
  - `subscribeVisibleForPlace`: union of five `onSnapshot` queries each with `where('placeId','==',id)` and `where('isDeleted','==',false)`: privacy == public; userId == viewer; taggedUserIds array-contains viewer; privacy == timeRelease && releaseDate <= now; privacy == community && communityId in viewerCommunityIds (skip when empty; chunk by 30). Merge, de-dupe, sort `createdAt` desc, slice 50. Add any composite index these need to `firestore.indexes.json`.
  - `auth.register` creates the `users/{uid}` doc (`defaultPrivacy: 'public'`, empty arrays) after `createUserWithEmailAndPassword` + `updateProfile`. Map `auth/email-already-in-use` and `auth/invalid-credential` to the same messages as Task 7.
  - `media.uploadMemoryImage`: `fetch(localUri).blob()` → `uploadBytes(ref('memory-images/{uid}/{memoryId}.jpg'), blob, { contentType: 'image/jpeg' })` → `getDownloadURL`.
- Aggregation contract case (`memoryCount` increments) is skipped here until Task 10; enable it in Task 10.

- [x] **Step 1: Write the emulator test** that runs all three contract suites against `createFirestoreBackend` connected via `connectFirestoreEmulator(db,'127.0.0.1',8080)`, `connectAuthEmulator(auth,'http://127.0.0.1:9099')`, `connectStorageEmulator(storage,'127.0.0.1',9199)`; `cleanup` calls the emulator REST reset endpoints. Add the Review Focus case **`finds a place whose geohash continues with z`** (place at a geohash `<prefix>z…` inside radius). `jest.emulator.config.js`: `testEnvironment: 'node'`, `testMatch: ['**/*.emulator.test.ts']`.
- [x] **Step 2: Run** `npx firebase emulators:exec --project demo-echoes --only auth,firestore,storage "npm --prefix mobile run test:emulator"` — Expected: FAIL (backend not implemented).
- [x] **Step 3: Implement** the Firestore backend.
- [x] **Step 4: Run** the same command — Expected: PASS (aggregation case skipped). Rules are the real `firestore.rules`/`storage.rules`; a permission error means the query shape does not match the rules — fix the query, not the rules.
- [x] **Step 5: Run** `npx firebase emulators:exec --only firestore "npm test --prefix rules_test"` — Expected: PASS (unchanged).
- [x] **Step 6: Commit** `feat(data): Firestore backend verified against emulator contracts`.

---

### Task 10: `onMemoryWritten` Cloud Function (ADR-0003)

**Files:**
- Create: `functions/aura.js`, `functions/onMemoryWritten.js`
- Modify: `functions/index.js` (export `onMemoryWritten`), `functions/package.json` (test script `node --test test/`)
- Test: `functions/test/aura.test.js`, `functions/test/onMemoryWritten.test.js`
- Modify: `mobile/test/firestoreBackend.emulator.test.ts` (un-skip aggregation), `.github/workflows/flutter.yml` (new step: `npx firebase-tools emulators:exec --project demo-echoes --only auth,firestore,storage,functions "npm --prefix mobile run test:emulator"`, after `npm ci` in `mobile` and `functions`)

**Interfaces:**
- Produces: `calculateAura(memories, now)` in `functions/aura.js` (CommonJS, same contract as `mobile/src/domain/aura.ts`, returns ISO `updatedAt`); `buildPlaceAggregate(memories: {privacy, isDeleted, sentiment, createdAt: Date}[], now: Date) => { aura, memoryCount, publicMemoryCount, updatedAt }`; trigger `onMemoryWritten = onDocumentWritten('memories/{memoryId}', handler)` which reads all memories with the after-or-before `placeId`, writes the aggregate to `places/{placeId}` with `{ merge: true }`, and adds `places/{placeId}/auraHistory/{autoId}` = `{ placeId, aura, recordedAt: ISO }`. If the place doc does not exist, do nothing.

- [x] **Step 1: Write failing tests:** `aura.test.js` iterates `../fixtures/domain/aura.json` (path relative to repo root) with the same assertions as Task 6; `onMemoryWritten.test.js`: `buildPlaceAggregate` counts non-deleted (`memoryCount`), non-deleted public (`publicMemoryCount`), and computes aura from non-deleted public only.
- [x] **Step 2: Run** `npm test --prefix functions` — Expected: FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** `npm test --prefix functions`, then `npx firebase emulators:exec --project demo-echoes --only auth,firestore,storage,functions "npm --prefix mobile run test:emulator"` — Expected: PASS including the aggregation contract case.
- [x] **Step 5: Commit** `feat(functions): compute place aura and counts on memory writes`.

---

### Task 11: Services — config, Firebase init, composition root

**Files:**
- Create: `mobile/src/services/config.ts`, `mobile/src/services/firebase.ts`, `mobile/src/services/createServices.ts`, `mobile/src/services/ServicesProvider.tsx`
- Create: `mobile/src/device/{types,expoLocation,expoImagePicker,fakes}.ts`
- Create: `mobile/.env.example`, `mobile/app.config.ts`
- Install: `npx expo install @react-native-async-storage/async-storage expo-location expo-image-picker expo-image-manipulator react-native-maps`
- Modify: `README.md` — new "Run the Expo app" section (memory / emulator / firebase modes, Expo Go steps, LAN host note)
- Test: `mobile/src/services/config.test.ts`, `mobile/src/services/createServices.test.ts`

**Interfaces:**
- Produces:
```ts
export type BackendMode = 'memory' | 'emulator' | 'firebase';
export interface AppConfig { backend: BackendMode; emulatorHost: string; firebase: { apiKey: string; authDomain: string; projectId: string; storageBucket: string; appId: string; messagingSenderId: string } | null }
export function readConfig(env: Record<string, string | undefined>): AppConfig; // default backend 'memory', emulatorHost '127.0.0.1'; throws Error('Missing EXPO_PUBLIC_FIREBASE_<KEY>') when backend needs firebase config and a key is absent; throws Error('Unknown EXPO_PUBLIC_BACKEND: x')
// device/types.ts
export interface LocationService { requestPermission(): Promise<'granted' | 'denied'>; getCurrentPosition(): Promise<LatLng> }
export interface ImagePickerService { pick(source: 'camera' | 'library'): Promise<{ uri: string; width: number; height: number; fileSize: number | null } | null> } // null = cancelled
export interface Services { config: AppConfig; repos: Repositories; location: LocationService; imagePicker: ImagePickerService; now(): Date; newId(): string }
export function createServices(config: AppConfig, overrides?: Partial<Services>): Services;
export function ServicesProvider(props: { services: Services; children: React.ReactNode }): JSX.Element;
export function useServices(): Services; // throws outside provider
// fakes.ts
export function fakeLocation(r: { permission?: 'granted' | 'denied'; position?: LatLng; error?: Error }): LocationService;
export function fakeImagePicker(result: Awaited<ReturnType<ImagePickerService['pick']>>): ImagePickerService;
export function testServices(overrides?: Partial<Services>): Services; // memory backend seeded at fixed now 2026-10-18T09:00:00Z, fake location at seed center, ids 'id-1','id-2',…
```
  - `firebase.ts`: `initFirebase(config): { db, auth, storage }` — `initializeApp`, `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`, `getFirestore`, `getStorage`; in `emulator` mode connect all three to `emulatorHost`. Only `createServices` calls it, never for `memory`.
  - `app/_layout.tsx` builds services once at module scope: `const services = createServices(readConfig(process.env))`.

- [x] **Step 1: Write failing tests:** `readConfig({})` → `backend:'memory'`, `firebase:null`; `readConfig({EXPO_PUBLIC_BACKEND:'emulator'})` uses project `demo-echoes` defaults and `emulatorHost:'127.0.0.1'`; `firebase` with a missing key throws the message; unknown backend throws; `createServices(readConfig({}))` returns repos whose `places.findNearest` finds a seeded place; `useServices` outside provider throws `'useServices must be used inside ServicesProvider'`.
- [x] **Step 2: Run** `npm --prefix mobile test -- config createServices` — Expected: FAIL.
- [x] **Step 3: Implement.** Expo location impl maps `Location.requestForegroundPermissionsAsync` status to `'granted'|'denied'` and uses `Accuracy.Balanced`. Image picker impl requests the matching permission, returns `null` on `canceled`.
- [x] **Step 4: Run** — Expected: PASS; `npx expo export --platform android` exits 0.
- [x] **Step 5: Commit** `feat(mobile): config, Firebase init, composition root, device services`.

---

### Task 12: Auth — validators, session gate, sign-in/register screen

**Files:**
- Create: `mobile/src/features/auth/validators.ts`, `useSession.ts`, `SignInScreen.tsx`; `mobile/app/sign-in.tsx`, `mobile/app/(app)/_layout.tsx`
- Modify: `mobile/app/_layout.tsx`
- Test: `mobile/src/features/auth/validators.test.ts`, `SignInScreen.test.tsx`, `mobile/test/authGate.test.tsx`

**Interfaces:**
- Produces: `validateEmail(v: string): string | null`, `validatePassword(v)`, `validateDisplayName(v)` (spec copy); `useSession(): { status: 'loading' | 'signedOut' | 'signedIn'; session: AuthSession | null }`; `(app)/_layout.tsx` redirects to `/sign-in` when `signedOut`; `sign-in.tsx` redirects to `/` when `signedIn`.
- Screen testIDs: `email-input`, `password-input`, `name-input`, `age-checkbox`, `submit-button`, `mode-toggle`. Mode toggle text: `Create an account` / `I already have an account`. Submit text: `Sign in` / `Create account`. Repository errors are shown in a `role="alert"` text.

- [x] **Step 1: Write failing tests:** validator table from spec copy; screen: empty submit shows `Email is required` and `Password is required`; register without age checkbox shows `You must be at least 13 to create an account.` and does not call `register`; demo credentials sign in and `useSession` becomes `signedIn`; wrong password shows `Incorrect email or password.`; authGate: rendering the router with `testServices()` signed-out lands on sign-in (`expo-router/testing-library` `renderRouter`).
- [x] **Step 2: Run** `npm --prefix mobile test -- auth` — Expected: FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** — Expected: PASS.
- [x] **Step 5: Commit** `feat(auth): sign-in and 13+ registration with session gate`.

---

### Task 13: Map screen with nearby places

**Files:**
- Create: `mobile/src/features/map/useNearbyPlaces.ts`, `MapScreen.tsx`
- Modify: `mobile/app/(app)/index.tsx`, `mobile/jest.setup.ts` (mock `react-native-maps`: `MapView` → `View` with `testID="map"`, `Marker` → `Pressable` passing `testID` and `onPress`)
- Test: `mobile/src/features/map/useNearbyPlaces.test.ts`, `MapScreen.test.tsx`

**Interfaces:**
- Produces: `NEARBY_RADIUS_METERS = 1500`; `useNearbyPlaces(): { status: 'locating' | 'denied' | 'error' | 'ready'; center: LatLng | null; places: Place[]; retry(): void }`.
- MapScreen: `MapView` centered on `center` showing the user location; one `Marker` per place (`testID="marker-{id}"`, `pinColor = place.aura.colorHex`, title = name); below it a list (`testID="place-row-{id}"`) with name, memory count `"{n} memories"` (`"1 memory"`), distance `"{m} m"` or `"{km.toFixed(1)} km"`; tap marker or row → `router.push('/place/{id}')`. Denied: text `Location permission is needed to find memories near you.` + button `Try again`. Error: `Couldn't get your location.` + `Try again`. Empty ready: `No memories within 1.5 km yet. Be the first to leave one.` Floating button `Add memory` → `/add-memory`.

- [x] **Step 1: Write failing tests:** hook with `fakeLocation({permission:'denied'})` → `denied`; **`shows error when position lookup throws`** (`fakeLocation({error})` → `error`); `retry()` re-requests; ready lists seeded places sorted by distance; screen renders a row and a marker per seeded place; pressing a row navigates to `/place/{id}`; **`shows denied state`** with the exact copy; `1 memory` singular.
- [x] **Step 2: Run** `npm --prefix mobile test -- map` — Expected: FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** — Expected: PASS.
- [x] **Step 5: Commit** `feat(map): nearby places map and list`.

---

### Task 14: Place screen with visible memories

**Files:**
- Create: `mobile/src/features/places/usePlaceMemories.ts`, `PlaceScreen.tsx`, `MemoryCard.tsx`; `mobile/app/(app)/place/[id].tsx`
- Test: `mobile/src/features/places/PlaceScreen.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `repos.places.findById`, `repos.memories.subscribeVisibleForPlace` (viewerCommunityIds from `repos.users.get(uid).communityIds`).
- Produces: `usePlaceMemories(placeId: string): { status: 'loading' | 'notFound' | 'ready' | 'error'; place: Place | null; memories: Memory[] }`. PlaceScreen header: name, aura chip (category label capitalised, background `colorHex`), `"{n} memories"`. `MemoryCard` (`testID="memory-{id}"`): text, image if `imageUrl`, local date `toLocaleDateString()`, privacy badge for non-public (`Private`, `Tagged`, `Time release`, `Community`). Empty: `No memories here yet.` Not found: `This place no longer exists.`

- [x] **Step 1: Write failing tests:** with seeded data signed in as demo user, the screen shows the place's public memories and the demo user's own private memory with a `Private` badge, but not another user's private memory; newest first; unknown id shows not-found copy.
- [x] **Step 2: Run** `npm --prefix mobile test -- PlaceScreen` — Expected: FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** — Expected: PASS.
- [x] **Step 5: Commit** `feat(places): place detail with privacy-aware memory list`.

---

### Task 15: Add memory — orchestration, image compression, screen

**Files:**
- Create: `mobile/src/features/memories/submitMemory.ts`, `compressImage.ts`, `AddMemoryScreen.tsx`; `mobile/app/(app)/add-memory.tsx`
- Test: `mobile/src/features/memories/submitMemory.test.ts`, `compressImage.test.ts`, `AddMemoryScreen.test.tsx`

**Interfaces:**
- Produces:
```ts
export const PLACE_MATCH_RADIUS_METERS = 100;
export const SUBMIT_TIMEOUT_MS = 15_000;
export interface MemoryDraft { textContent: string; privacy: PrivacyType; releaseDate: Date | null; taggedUserIds: string[]; communityId: string | null; location: LatLng | null; imageUri: string | null }
export type SubmitResult = { ok: true; memoryId: string; placeId: string } | { ok: false; error: string };
export function submitMemory(services: Services, userId: string, draft: MemoryDraft): Promise<SubmitResult>;
// compressImage.ts
export const UPLOAD_LIMIT_BYTES = 1_048_576;
export function compressImage(uri: string, deps?: { manipulate: typeof manipulateAsync; sizeOf(uri: string): Promise<number> }): Promise<string>;
```
  - `submitMemory` order: trim text; empty → `'Write something to remember.'`, > 2000 → `'Memories can be at most 2000 characters.'`; `validatePrivacy` (with `services.now()`); location null → `'Capture location before saving.'`; compress + upload image (failure → `'Photo upload failed. Try again or remove the photo.'`); `findNearest` within 100 m, else create place `{ name: 'Memory Place', custodianIds: [userId], aura: emptyAura(now), memoryCount: 0, publicMemoryCount: 0, communityId: null }`; create memory with `analyzeSentiment(text)`, `encodeGeohash`, `isDeleted:false`, `deletedAt:null`. All repository calls together wrapped in a `SUBMIT_TIMEOUT_MS` race → `'Could not reach the server. Check your connection and try again.'`
  - `compressImage`: resize to max width 1600, JPEG quality 0.7; while size > limit, lower quality by 0.15 (min 0.25) then halve width; return final uri; throws `Error('Photo is too large to upload.')` if still over.
  - Screen: multiline `text-input` with counter `"{n}/2000"`; privacy segmented control `Public | Private | Time release` (tagged/community arrive in Plan 3); date picker row for time release (`release-date-button`, use `@react-native-community/datetimepicker` via `npx expo install`); `Use my location` button capturing via `services.location` showing `Location captured` when set; `Add photo` → `services.imagePicker.pick('library')` with thumbnail and `Remove photo`; `Save memory` disabled while submitting; on success `router.replace('/place/{placeId}')`; errors in `role="alert"`.

- [ ] **Step 1: Write failing tests:**
  - submitMemory: creates a new place when none within 100 m (`name 'Memory Place'`, creator custodian); reuses the seeded place 40 m away; sentiment equals `analyzeSentiment(text)`; whitespace-only text error; 2001 chars error; timeRelease in the past error; image uploaded and `imageUrl` set; upload failure error with no memory created; **`times out after 15 s with a connection error`** (repo `create` returns a never-settling promise; jest fake timers advance 15 000 ms).
  - compressImage: **`compresses until under the upload limit`** (fake `sizeOf` returns 4_000_000, 1_500_000, 900_000 → resolves after 3 manipulations); throws when never under limit.
  - Screen: type text, choose Public, capture location, save → navigates to the place and the new memory is listed; **`ignores a cancelled pick`** (`fakeImagePicker(null)` → no thumbnail, no error); counter shows `5/2000` after typing `hello`.
- [ ] **Step 2: Run** `npm --prefix mobile test -- memories` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(memories): add memory with photo, privacy and place matching`.

---

### Task 16: Plan 1 verification and status

**Files:**
- Modify: `status.md` (add "Expo rewrite — Plan 1" section with the gate table below), `README.md` (point to `mobile/` as the active client)

- [ ] **Step 1: Run every gate and record results**

```bash
npm --prefix mobile test
npm --prefix mobile run typecheck
npm --prefix mobile run lint
npm test --prefix functions
npx firebase emulators:exec --project demo-echoes --only auth,firestore,storage,functions "npm --prefix mobile run test:emulator"
npx firebase emulators:exec --only firestore "npm test --prefix rules_test"
cd mobile && npx expo export --platform android --output-dir dist && npx expo export --platform ios --output-dir dist-ios
```
Expected: every command exits 0. Any failure → fix in the owning task's files and re-run; do not mark this step done while anything fails.

- [ ] **Step 2: Update `status.md`** with the gate table (command → Pass + test count) and the manual Expo Go check list: `cd mobile && npx expo start` → scan QR → sign in with demo credentials → map shows 6+ markers → open a place → add a memory → it appears on the place.
- [ ] **Step 3: Commit** `docs: record Expo Plan 1 verification`.
