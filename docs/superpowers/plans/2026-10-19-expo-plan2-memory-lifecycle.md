# ECHOES Expo Plan 2 — Memory Lifecycle, Voice, Offline, Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every task is TDD: superpowers:test-driven-development.

**Goal:** Users can open, edit, delete and restore their memories, attach 60-second voice notes, keep capturing memories offline (drafts sync later, surviving app restarts), manage a profile with default privacy, and permanently delete their account.

**Architecture:** Extends Plan 1's repository interfaces (memory + Firestore backends, shared contract suites) and device-service interfaces (Expo + fake implementations). Offline capture uses a persisted outbox of drafts with fixed ids (ADR-0006). Server side gains a rules change (authors read their own deleted memories; `audioUrl` mutable) and a scheduled purge function.

**Tech Stack:** Expo SDK 58, expo-router, firebase JS SDK 13, expo-audio, expo-network, expo-file-system, @react-native-async-storage/async-storage, Jest + RNTL 14, firebase-functions v7 (`onSchedule`).

**Spec:** `docs/superpowers/specs/2026-10-18-expo-rewrite-design.md` (sections "Plan 2 decisions" and Data contract) + `docs/adr/0006-offline-outbox.md`.

## Global Constraints

- All Plan 1 Global Constraints still apply (see `docs/superpowers/plans/2026-10-18-expo-foundation-core-loop.md`).
- Work on branch `expo-rewrite`.
- `RESTORE_WINDOW_DAYS = 30`; `MAX_VOICE_SECONDS = 60`; voice upload limit `5_242_880` bytes; outbox backoff seconds `[2, 4, 8, 16, 32, 64]`.
- Firestore memory update payloads must only touch fields allowed by `firestore.rules` (`mutableMemoryEditOnly`, `softDeleteOnly`, `restoreOnly`); never rewrite immutable fields with new values.
- All copy strings verbatim from the spec section "Plan 2 decisions".
- Every new device capability has an interface in `src/device/types.ts`, an Expo implementation, and a fake in `src/device/fakes.ts`; `testServices()` wires fakes.
- Every task ends green on `npm --prefix mobile test`, `typecheck`, `lint`; tasks touching Firestore/rules/functions also run the emulator suites listed in Task 13.
- RNTL 14: `render` and `fireEvent` are async; test output pristine.

## Review Focus

1. **Outbox replay after a partial success** — first attempt created the place and uploaded the photo but the memory write timed out; the replay must not create a second place or memory. Pinned in Task 6 (`replay after partial success creates nothing twice`).
2. **Restore after the window** — day 31 must show `This memory can no longer be restored.`, never a raw permission error. Pinned in Task 9 (`shows expired copy when restore is rejected`).
3. **Voice note at exactly 60 s and app backgrounded mid-recording** — recording stops at 60 s; a stop that returns no file leaves the form without a voice note and no crash. Pinned in Task 10 (`auto-stops at 60 seconds`, `ignores a recording that produced no file`).
4. **Account deletion with a wrong password or a stale session** — shows `Incorrect password.` and keeps the user signed in. Pinned in Task 12 (`wrong password keeps the account`).
5. **Edit that changes privacy away from timeRelease** — stale `releaseDate`/`taggedUserIds`/`communityId` must be cleared so the memory is not mis-shown. Pinned in Task 8 (`switching to public clears release date`).

---

## File Structure

```
firestore.rules, rules_test/firestore.rules.test.js           Task 2
functions/purgeDeletedMemories.js, functions/test/purge*.js    Task 4
mobile/src/domain/memoryLifecycle.ts (+test)                   Task 1
mobile/src/data/types.ts, data/memory/*, data/firestore/*      Tasks 3, 4b
mobile/test/contracts/memories.contract.ts, users/auth         Task 3
mobile/src/device/{types,fakes}.ts + expoNetwork, expoAudio, keyValueStore, fileStore   Task 5
mobile/src/features/outbox/{outbox,processor,useOutbox,OutboxBanner}.ts(x)              Task 6
mobile/src/features/memories/{submitMemory,AddMemoryScreen}.ts(x)                      Task 6, 10
mobile/src/features/memories/{MemoryDetailScreen,EditMemoryScreen,VoiceRecorder,VoiceNotePlayer}.tsx  Tasks 7, 8, 10
mobile/src/features/profile/{ProfileScreen,RecentlyDeletedScreen,DeleteAccountScreen}.tsx            Tasks 9, 11, 12
mobile/app/(app)/{memory/[id],memory/[id]/edit,profile,recently-deleted,delete-account}.tsx
```

---

### Task 1: Domain — memory lifecycle helpers

**Files:** Create `mobile/src/domain/memoryLifecycle.ts`, `mobile/src/domain/memoryLifecycle.test.ts`; Modify `mobile/src/features/memories/submitMemory.ts` (import the shared text validator instead of its own checks).

**Interfaces — Produces:**
- `RESTORE_WINDOW_DAYS = 30`
- `restoreDaysLeft(m: Pick<Memory,'isDeleted'|'deletedAt'>, now: Date): number` — whole days left, `Math.ceil`, `0` when not deleted / expired.
- `canRestore(m, now): boolean` — `isDeleted && deletedAt !== null && now < deletedAt + 30 d`.
- `validateMemoryText(text: string): string | null` — trims; `''` → `Write something to remember.`; > 2000 → `Memories can be at most 2000 characters.`
- `placeIdForNewMemory(memoryId: string): string` → `'p_' + memoryId`.
- `normalizePrivacyFields(input: { privacy; taggedUserIds; releaseDate; communityId }): same shape` — clears fields not used by the chosen privacy (`tagged` keeps taggedUserIds, `timeRelease` keeps releaseDate, `community` keeps communityId; all others set to `[]`/`null`).

- [x] **Step 1: Failing tests** — restoreDaysLeft: deleted 0 ms ago → 30; 29 d 1 h ago → 1; exactly 30 d → 0; not deleted → 0. canRestore: 30 d − 1 ms → true, 30 d → false. validateMemoryText table. normalizePrivacyFields: public clears all three; timeRelease keeps date and clears tags/community.
- [x] **Step 2: Run** `npm --prefix mobile test -- memoryLifecycle` → FAIL.
- [x] **Step 3: Implement**; refactor submitMemory to use `validateMemoryText` (existing tests must stay green).
- [x] **Step 4: Run** full mobile gates → PASS.
- [x] **Step 5: Commit** `feat(domain): memory lifecycle helpers`.

---

### Task 2: Firestore rules — own deleted memories readable, audioUrl mutable

**Files:** Modify `firestore.rules`, `rules_test/firestore.rules.test.js`.

**Change:** `match /memories/{memoryId}`: `allow get, list: if isVisibleMemory(resource.data) || (signedIn() && resource.data.userId == request.auth.uid);` Add `'audioUrl'` to `mutableMemoryEditOnly`'s list. Nothing else.

- [x] **Step 1: Failing rules tests** — author can `get` and `list` (`where userId == uid, isDeleted == true`) own deleted memory; another user cannot `get` it; author can update `audioUrl` alone; author still cannot change `placeId`; non-author cannot set `audioUrl`.
- [x] **Step 2: Run** `npx firebase emulators:exec --only firestore "npm test --prefix rules_test"` → new tests FAIL, old PASS.
- [x] **Step 3: Change the rules.**
- [x] **Step 4: Run** → all PASS.
- [x] **Step 5: Commit** `feat(rules): authors read own deleted memories; audioUrl attachable`.

---

### Task 3: Repository extensions — memory backend + contracts

**Files:** Modify `mobile/src/data/types.ts`, `mobile/src/data/memory/{memories,users,auth,media,store}.ts`, contract suites in `mobile/test/contracts/` (+ new `users.contract.ts`), `mobile/src/data/memory/memoryBackend.test.ts`.

**Interfaces — Produces (added to existing interfaces):**
```ts
interface MemoryRepository {
  findById(id: string): Promise<Memory | null>;                         // author may read own deleted; others only visible
  subscribeForUser(userId: string, cb: (m: Memory[]) => void, onError?): Unsubscribe;        // not deleted, newest first, ≤ 50
  subscribeDeletedForUser(userId: string, cb: (m: Memory[]) => void, onError?): Unsubscribe; // deleted, newest deletedAt first, ≤ 50
  update(id: string, patch: { textContent: string; privacy: PrivacyType; taggedUserIds: string[]; releaseDate: Date | null; communityId: string | null }, updatedAt: Date): Promise<void>;
  attachMedia(id: string, media: { imageUrl?: string; audioUrl?: string }, updatedAt: Date): Promise<void>;
  softDelete(id: string, at: Date): Promise<void>;
  restore(id: string, at: Date): Promise<void>;                          // rejects Error('This memory can no longer be restored.') outside the window
}
interface UserRepository { updateDefaultPrivacy(userId: string, privacy: 'public' | 'private', at: Date): Promise<void> }
interface AuthRepository { deleteAccount(password: string): Promise<void> }  // wrong password → Error('Incorrect password.')
interface MediaRepository { uploadMemoryAudio(input: { userId: string; memoryId: string; localUri: string }): Promise<string> }
```
Memory backend: `update`/`softDelete`/`restore` recompute the place aggregate (deleted memories drop out of counts/aura, restore brings them back); `deleteAccount` removes the user's memories, user doc, credentials and signs out, then recomputes affected places; `register` now also creates the `users` record (Plan 1 gap). Media audio returns `localUri`.

- [x] **Step 1: Failing contract cases** (backend-agnostic, polling where aggregation is async): findById own deleted → returned for author, null for stranger; subscribeForUser excludes deleted, newest first; subscribeDeletedForUser lists deleted; update changes text/privacy and keeps createdAt; softDelete → place memoryCount decreases (poll); restore within window → back; restore after 31 days → rejects with the expired message; attachMedia sets audioUrl; updateDefaultPrivacy persists; deleteAccount wrong password rejects `Incorrect password.` and session stays; deleteAccount right password → session null and user's memories gone (poll).
- [x] **Step 2: Run** `npm --prefix mobile test -- memoryBackend` → FAIL.
- [x] **Step 3: Implement** the memory backend changes (inject `now` for the 31-day case via the backend clock).
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(data): memory lifecycle, voice upload and account deletion in memory backend`.

---

### Task 4: Firestore implementations + purge function

**Files:** Modify `mobile/src/data/firestore/{memories,users,auth,media}.ts`, `mobile/test/firestoreBackend.emulator.test.ts`, `firestore.indexes.json`; Create `functions/purgeDeletedMemories.js`, `functions/test/purgeDeletedMemories.test.js`; Modify `functions/index.js`.

**Interfaces:** Firestore implementations of Task 3. Payloads: `update` → `updateDoc({ ...normalizePrivacyFields(patch), releaseDate: Timestamp|null, updatedAt: Timestamp })`; `attachMedia` → only the given url field(s) + `updatedAt`; `softDelete` → `{ isDeleted: true, deletedAt, updatedAt }`; `restore` → `{ isDeleted: false, deletedAt: null, updatedAt }`, map `permission-denied` to the expired message; `deleteAccount` → `reauthenticateWithCredential(user, EmailAuthProvider.credential(email, password))` then `deleteUser` (map `auth/invalid-credential`/`auth/wrong-password` → `Incorrect password.`); `uploadMemoryAudio` → `memory-audio/{uid}/{memoryId}.m4a`, `contentType: 'audio/mp4'`. Index for `userId ==, isDeleted ==, createdAt desc` and `userId ==, isDeleted ==, deletedAt desc`.
`purgeDeletedMemories = onSchedule('every 24 hours', handler)`; `purgeExpired(db, bucket, now)` deletes memories with `isDeleted == true && deletedAt < now − 30 d` (batched, ≤ 500/batch, paginated) and their `memory-images/{uid}/{id}.jpg` / `memory-audio/{uid}/{id}.m4a` (ignore 404). Export `purgeExpired` via `__private__` for tests.

- [x] **Step 1: Failing tests** — emulator test runs the extended contracts for Firestore (aggregation via `onMemoryWritten`); functions unit test for `purgeExpired` with a fake db/bucket: purges 31-day-old deleted, keeps 29-day-old deleted and live memories, deletes both storage paths, tolerates missing files.
- [x] **Step 2: Run** emulator + functions tests → FAIL.
- [x] **Step 3: Implement.** Ensure `cleanupDeletedUser` still passes its tests.
- [x] **Step 4: Run** all Task 13 gates that apply → PASS.
- [x] **Step 5: Commit** `feat(data): Firestore memory lifecycle, account deletion, purge job`.

---

### Task 5: Device services — network, storage, files, audio

**Files:** Modify `mobile/src/device/types.ts`, `mobile/src/device/fakes.ts`, `mobile/src/services/{services,createServices}.ts`; Create `mobile/src/device/{expoNetwork,keyValueStore,fileStore,expoAudio}.ts`. Install: `npx expo install expo-network expo-audio`.

**Interfaces — Produces:**
```ts
interface ConnectivityService { isOnline(): Promise<boolean>; subscribe(cb: (online: boolean) => void): () => void }
interface KeyValueStore { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void> }
interface FileStore { persist(uri: string, name: string): Promise<string>; remove(uri: string): Promise<void> }   // persist copies into <documentDirectory>/outbox/<name>
interface AudioRecorderService { requestPermission(): Promise<'granted' | 'denied'>; start(): Promise<void>; stop(): Promise<{ uri: string; durationMs: number } | null> }
interface AudioPlayerService { load(url: string): { play(): void; pause(): void; release(): void; onStatus(cb: (s: { playing: boolean; error: boolean; finished: boolean }) => void): () => void } }
interface Services { connectivity; keyValue; files; audioRecorder; audioPlayer }   // added
```
Fakes: `fakeConnectivity(initial = true)` with `.setOnline(b)`; `memoryKeyValue()`; `fakeFiles()` (returns `'persisted://'+name`); `fakeAudioRecorder({ permission?, result? })`; `fakeAudioPlayer()` recording calls. Expo impls: `expo-network` (`getNetworkStateAsync().isInternetReachable ?? isConnected`, `addNetworkStateListener`), AsyncStorage, `expo-file-system` `File`/`Directory`/`Paths.document` (verify SDK 58 API), `expo-audio` recorder with AAC `.m4a` preset (verify API; `RecordingPresets.HIGH_QUALITY` on SDK 58) and `createAudioPlayer`.

- [x] **Step 1: Failing tests** — fakes behave as specified; `createServices` wires Expo impls and `testServices` wires fakes (identity checks).
- [x] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** gates + `npx expo export --platform android` → PASS.
- [x] **Step 5: Commit** `feat(device): connectivity, key-value, file and audio services`.

---

### Task 6: Offline outbox (ADR-0006)

**Files:** Create `mobile/src/features/outbox/{outbox,processor,useOutbox,OutboxBanner}.ts(x)` + tests; Modify `mobile/src/features/memories/{submitMemory,AddMemoryScreen}.ts(x)` (+ tests), `mobile/src/features/map/MapScreen.tsx` (banner), `mobile/app/(app)/_layout.tsx` (start processor while signed in).

**Interfaces — Produces:**
```ts
interface OutboxDraft { memoryId: string; placeIdIfNew: string; userId: string; createdAt: string /*ISO*/; textContent: string; privacy: PrivacyType; releaseDate: string | null; taggedUserIds: string[]; communityId: string | null; location: LatLng; imageUri: string | null; audioUri: string | null }
class Outbox { constructor(store: KeyValueStore, files: FileStore, userId: string); list(): Promise<OutboxDraft[]>; add(d: OutboxDraft): Promise<void>; remove(memoryId: string): Promise<void>; subscribe(cb: (n: number) => void): () => void }   // key `outbox:<uid>`; add() persists media via files.persist
function prepareDraft(services: Services, userId: string, draft: MemoryDraft): { ok: true; draft: OutboxDraft } | { ok: false; error: string }   // validation (text, privacy, location); fixes ids/createdAt
function runDraft(services: Services, d: OutboxDraft): Promise<{ memoryId: string; placeId: string }>   // idempotent: upload image/audio to fixed paths; place = findNearest(100 m) ?? (findById(placeIdIfNew) ?? create(placeIdIfNew)); memories.create (setDoc at memoryId)
function submitMemory(services, userId, draft, outbox): Promise<SubmitResult>   // prepare → race(runDraft, 15 s); on timeout or network error → outbox.add → { ok: true; queued: true; memoryId }; on success → { ok: true; queued: false; memoryId; placeId }
class OutboxProcessor { constructor(services: Services, outbox: Outbox); start(): () => void; retryNow(): Promise<void> }   // runs on start, on connectivity→online, on retryNow; backoff [2,4,8,16,32,64] s, reset on any success or retryNow; removes drafts + persisted files on success
function useOutbox(): { pending: number; retry(): void }
```
`SubmitResult` gains `queued`. Plan 1's `startSubmit`/`awaitWithTimeout`/single-flight in AddMemoryScreen are removed (ADR-0006 supersedes R10). Screen: success → `router.replace('/place/{placeId}')`; queued → show `Saved offline. It will upload when you're back online.` then `router.replace('/')`. Banner on map when `pending > 0`: `{n} memory waiting to upload` / `{n} memories waiting to upload` + `Retry`. Network errors = Firestore `unavailable`, Storage `storage/retry-limit-exceeded`, or `TypeError: Network request failed`; validation errors never queue.

- [x] **Step 1: Failing tests** — submit with repo create never settling → queued after 15 s, draft persisted with `memoryId`, timers cleared; processor replays when connectivity flips online and removes the draft; backoff schedule (fake timers: failures at 2, 4, 8 s; success resets); **`replay after partial success creates nothing twice`** (place `p_<id>` and photo already exist, memory missing → after replay exactly one place and one memory); outbox survives a new `Outbox` instance over the same store (restart); drafts are per-user (`outbox:<uid>`); banner pluralisation and Retry calls `retryNow`.
- [x] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** gates → PASS.
- [x] **Step 5: Commit** `feat(outbox): persisted offline drafts with idempotent replay`.

---

### Task 7: Memory detail screen + delete

**Files:** Create `mobile/src/features/memories/MemoryDetailScreen.tsx` (+test), `mobile/app/(app)/memory/[id].tsx`; Modify `mobile/src/features/places/MemoryCard.tsx` (press → `/memory/{id}`).

**Interfaces:** `useMemory(id)` → `{ status: 'loading'|'notFound'|'ready'|'error'; memory }` via `repos.memories.findById`. Screen shows text, image, `VoiceNotePlayer` slot (rendered in Task 10; until then show nothing for audio), privacy badge (reuse MemoryCard's badge logic — extract `privacyLabel(m)` to `src/ui/privacyLabel.ts`), `createdAt.toLocaleString()`. Author-only actions `Edit` (→ `/memory/{id}/edit`) and `Delete` (confirm dialog per spec via `Alert.alert`; on confirm `softDelete(id, now)` then `router.back()`). Not found copy: `This memory is no longer available.`

- [x] **Step 1: Failing tests** — author sees Edit/Delete, stranger does not; Delete → confirm → memory soft-deleted and navigates back (mock `Alert.alert` to press `Delete`); Cancel does nothing; card press navigates to `/memory/{id}`; not-found copy.
- [x] **Step 2–4:** Run FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(memories): memory detail with author delete`.

---

### Task 8: Edit memory screen

**Files:** Create `mobile/src/features/memories/EditMemoryScreen.tsx` (+test), `mobile/app/(app)/memory/[id]/edit.tsx`; extract the privacy segmented control + release-date row from `AddMemoryScreen` into `mobile/src/features/memories/PrivacyPicker.tsx` and reuse it in both screens.

**Behaviour:** title `Edit memory`; text input with counter; PrivacyPicker (Public | Private | Time release); `Save changes` validates with `validateMemoryText` + `validatePrivacy(now)`; saves `memories.update(id, normalizePrivacyFields(...), now)` under the 15 s timeout (timeout → `Could not reach the server. Check your connection and try again.`); success → `router.back()`. Only the author can open it (others → `router.back()` with no render).

- [x] **Step 1: Failing tests** — prefilled values; save updates text; **`switching to public clears release date`** (timeRelease memory edited to Public → stored releaseDate null); past release date → `Choose a future release date.`; timeout copy; AddMemoryScreen tests still pass after the PrivacyPicker extraction.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(memories): edit text and privacy`.

---

### Task 9: Recently deleted + restore

**Files:** Create `mobile/src/features/profile/RecentlyDeletedScreen.tsx` (+test), `mobile/app/(app)/recently-deleted.tsx`.

**Behaviour:** `subscribeDeletedForUser(uid)`; rows show text (2 lines), `Restorable for {n} days` / `Restorable for 1 day` (`restoreDaysLeft`), `Restore` button (`testID="restore-{id}"`) → `restore(id, now)`; rows with `canRestore === false` are not shown; empty copy per spec; restore rejection → `This memory can no longer be restored.` in `role="alert"`.

- [x] **Step 1: Failing tests** — lists deleted memories with days left (29 d 1 h old → `Restorable for 1 day`); Restore moves it back (row disappears, memory visible again); **`shows expired copy when restore is rejected`** (repo restore rejects); empty state.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(profile): recently deleted with 30-day restore`.

---

### Task 10: Voice notes — record, upload, play

**Files:** Create `mobile/src/features/memories/{VoiceRecorder,VoiceNotePlayer}.tsx` (+tests); Modify `AddMemoryScreen.tsx` (recorder), `MemoryDetailScreen.tsx` + `MemoryCard.tsx` (player / "Voice note" indicator), `submitMemory`/`runDraft` (audio upload via `media.uploadMemoryAudio`, persisted by the outbox like images).

**Behaviour:** VoiceRecorder states idle → recording (`Recording {s}s / 60s`, `Stop`) → ready (`Voice note ready ({s}s)`, `Remove voice note`); permission denied → `Microphone permission is needed for voice notes.`; auto-stop at 60 s (1 s interval); `stop()` returning null → back to idle with no error. Player: `Play voice note` / `Pause voice note` toggle, label `Voice note`, error → `Voice note unavailable`, resets to play on `finished`, releases on unmount.

- [x] **Step 1: Failing tests** — **`auto-stops at 60 seconds`** (fake timers); **`ignores a recording that produced no file`**; denied copy; submit with audio uploads to `memory-audio` and sets `audioUrl`; queued draft persists the audio file; player toggles, shows error copy, releases on unmount.
- [x] **Step 2–4:** FAIL → implement → PASS (+ `npx expo export --platform android`).
- [x] **Step 5: Commit** `feat(memories): 60-second voice notes`.

---

### Task 11: Profile screen + default privacy

**Files:** Create `mobile/src/features/profile/ProfileScreen.tsx` (+test), `mobile/app/(app)/profile.tsx`; Modify `MapScreen.tsx` (header button `Profile` → `/profile`), `AddMemoryScreen.tsx` (initial privacy = user's `defaultPrivacy`, fallback public).

**Behaviour:** header `displayName ?? 'ECHOES custodian'` + email; stat `Memories` = live count from `subscribeForUser` (shows `50+` at the limit); `Default privacy for new memories` Public/Private → `users.updateDefaultPrivacy`; `Your memories` list of `MemoryCard`s (empty copy per spec); buttons `Recently deleted` → `/recently-deleted`, `Sign out` → `auth.signOut()`, `Delete account` → `/delete-account`.

- [x] **Step 1: Failing tests** — shows name fallback, count, own memories only; changing default privacy persists and AddMemoryScreen opens with Private selected; Sign out → session null; navigation buttons push the right routes.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(profile): profile, my memories, default privacy`.

---

### Task 12: Account deletion

**Files:** Create `mobile/src/features/profile/DeleteAccountScreen.tsx` (+test), `mobile/app/(app)/delete-account.tsx`.

**Behaviour:** spec copy; password field `Confirm your password` (secureTextEntry); `Delete permanently` disabled until a password is typed and while busy; calls `auth.deleteAccount(password)`; also clears this user's outbox (`Outbox.clear()` — add it, removes persisted files) **after** successful deletion; on success the session gate routes to `/sign-in`; `Incorrect password.` and unknown errors (generic copy) in `role="alert"`.

- [x] **Step 1: Failing tests** — **`wrong password keeps the account`** (error shown, session still signed in); success → session null, user's memories gone from the memory backend, outbox cleared; button disabled when empty.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(profile): account deletion with re-authentication`.

---

### Task 13: Plan 2 verification

**Files:** Modify `status.md` (Plan 2 section above Plan 1's), `README.md` (features list).

- [x] **Step 1: Run every gate**
```bash
npm --prefix mobile test
npm --prefix mobile run typecheck
npm --prefix mobile run lint
npm test --prefix functions
npx firebase emulators:exec --project demo-echoes --only auth,firestore,storage,functions "npm --prefix mobile run test:emulator"
npx firebase emulators:exec --only firestore "npm test --prefix rules_test"
cd mobile && npx expo export --platform android --output-dir dist && npx expo export --platform ios --output-dir dist-ios
```
Expected: all exit 0.
- [x] **Step 2: Update `status.md`** with the gate table and the manual Expo Go checklist for Plan 2 (edit, delete, restore, voice note record/play, airplane-mode save then reconnect, profile default privacy, delete account).
- [x] **Step 3: Commit** `docs: record Expo Plan 2 verification`.

## Appendix — rulings made during execution
- Ruling R11: switch mutableMemoryEditOnly/softDeleteOnly/restoreOnly to diff().affectedKeys() (added+removed+changed) with tests that adding an unknown field is denied on each path — spec "privacy by design"/public launch outweighs plan scope; idempotent outbox replay (empty diff) still allowed — cost if wrong: some legit write that adds a new field gets denied (none exist today).
- Ruling R12: on Firestore, account-deletion data cleanup is server-side only (existing `cleanupDeletedUser` Auth onDelete trigger, Admin SDK) — rules forbid client memory deletes; client only re-auths + deleteUser; `findById` maps permission-denied → null — cost if wrong: if the emulator doesn't fire auth triggers, the "memories gone" contract case must be capability-gated.
- Ruling R13: pin soft-delete `deletedAt` to server time — rules `softDeleteOnly` requires `request.resource.data.deletedAt == request.time` and clients write `serverTimestamp()`; the 31-day restore contract case becomes memory-backend-only and an equivalent rules_test seeds an old deleted doc with rules disabled; fix in the final fix wave together with purge timeout/chunking — cost if wrong: client-side optimistic deletedAt display must wait for server value.
- Ruling R14: fix all three now. Permanent errors (permission-denied, invalid-argument, storage/unauthorized, storage/object-not-found, Error('Photo is too large to upload.')) mark the draft `failed` (persisted), stop auto-retry; banner shows failed count with copy `{n} memory couldn't upload` / `{n} memories couldn't upload` and a `Discard` button (confirm `Discard memories that couldn't upload?` / `They can't be recovered.` / `Cancel` / `Discard`); Retry also retries failed drafts once. Also fold minor #4 (skip drafts whose submit is in flight) and #5 (backoff-reset test). Minor #6 (clear outbox on account deletion) stays in Task 12 — cost if wrong: extra UI copy to adjust.
- Ruling R15: editing text must recompute sentiment (aura correctness) — add 'sentiment' to firestore.rules mutableMemoryEditOnly allow-list, `MemoryRepository.update` patch gains `sentiment`, Edit computes `analyzeSentiment(text)`; applied in Task 8 fix round — cost if wrong: one more mutable field (validated shape not enforced by rules).
- Ruling R16: on edit, run validatePrivacy only when privacy or releaseDate changed from the stored memory — fixing a typo in a released memory must work — cost if wrong: none (unchanged values were valid when saved).
- Ruling R17: Add Memory's Save is disabled until the user's default privacy has resolved; if loading fails the form defaults to Private (safe direction) — cost if wrong: a brief disabled Save on slow networks.
- Ruling R18: carry residual (b) + place-field restriction + bucket templating + transfers read-only + release-readiness note ("deploying these rules retires the Flutter client") into Plan 3 Task 2 (rules); production rules must not be deployed before Plan 3 Task 2 lands — cost if wrong: none (nothing is deployed yet).
