# ECHOES Expo Plan 3 — Social, Notifications Inbox, Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every task is TDD: superpowers:test-driven-development.

**Goal:** People can find each other by name, tag them and share memories with communities, hand custodianship of places to others, register institutions with verified admins, receive in-app notifications, and keep the space safe with report, block, auto-hide and terms acceptance. Everything runs in Expo Go.

**Architecture:**
- Privileged and multi-document writes move to callable Cloud Functions (ADR-0007), and clients get read-only rules for social collections.
- The in-memory backend emulates the same server logic in-process.
- Shared contract suites run against both backends. The emulator run calls real callables via `connectFunctionsEmulator`.
- Safety follows ADR-0008.

**Tech Stack:**
- Mobile: Expo SDK 58, expo-router, firebase JS SDK 13 (`firebase/functions` `httpsCallable`), react-native-svg (via `npx expo install`).
- Backend: firebase-functions v7 (`onCall`, `onDocumentWritten`, `onSchedule`), firebase-admin v13.
- Tests: Jest + RNTL 14, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-18-expo-rewrite-design.md` ("Plan 3 decisions" — data shapes and exact copy) + `docs/adr/0007-server-authoritative-social.md` + `docs/adr/0008-safety-and-moderation.md`.

## Global Constraints

- All Plan 1/2 Global Constraints apply. No Claude attribution and no `Co-Authored-By` trailer in commits. Branch `expo-rewrite`.
- Copy strings are taken verbatim from the spec's "Plan 3 decisions". Shared copy lives in `mobile/src/data/errors.ts` (or `mobile/src/ui/copy.ts` for UI-only strings) and is never duplicated as literals.
- Callables:
  - Every callable requires auth (`unauthenticated` otherwise) and validates all input (`invalid-argument`).
  - Every callable enforces blocks in both directions (`permission-denied`).
  - Rate limits use `rateLimits/{uid}_{action}_{yyyymmdd}` (`resource-exhausted`). Limits per day: reports 20, invites 50, transfers 20, community creation 10.
  - Errors are `HttpsError` codes. The client maps codes to the spec copy, so raw messages never reach the UI.
- Clients never write `communities`, `members`, `transfers`, `institutions`, `reports`, `notificationRequests`, `rateLimits`, or other users' data. Rules enforce this, and rules tests prove it.
- Dates are ISO strings except the memory fields that are already Timestamps.
- Every list is `limit(50)` or less. Every new query has its index in `firestore.indexes.json`.
- In-app notifications respect `users/{uid}.notificationPrefs` and blocks, and never notify the actor themself.
- RNTL 14: always `await` `render`/`fireEvent` (never `void`). Test output pristine. Tests order-independent (`--randomize` passes).

## Review Focus

1. **Blocked users stay blocked everywhere.** Pinned in Task 4 (`blocked users cannot tag, invite or transfer`) and Task 13 (`hides blocked authors' memories on place and community feeds`).
   - A blocked user can't tag, invite or transfer to the blocker.
   - The blocker never sees the blocked user's memories on the place screen, community feed, or inbox.
2. **Accepting a transfer when the sender has since left or the place is gone.** It must fail cleanly (`failed-precondition` mapped to generic copy) and never duplicate a custodian. Pinned in Task 5 (`accept after place deleted fails cleanly`, `accept is idempotent`).
3. **Auto-hide threshold races.** Three simultaneous reports hide the memory exactly once. A duplicate report from the same user doesn't count. Pinned in Task 6 (`three distinct reporters hide once`, `duplicate reporter does not count`).
4. **Display-name search with mixed case, accents and emoji.** Prefix search is case-insensitive on `displayNameLower` (NFKD-normalised, diacritics stripped). A 1-character query returns the hint, not a scan. Pinned in Task 1 (`normalizes names for search`) and Task 9 (`requires two characters`).
5. **Institution admin claim with an unverified or look-alike email domain.** `alumni.uv.edu` must not match `uv.edu` unless listed, and an unverified email is refused. Pinned in Task 6 (`rejects subdomain and unverified email`).

---

## File Structure

```
firestore.rules, storage.rules, firestore.indexes.json, rules_test/*          Task 3
functions/lib/{callable,rateLimit,notify,blocks}.js + tests                     Task 4
functions/{communities,transfers,institutions,safety,tags}.js + tests           Tasks 4–6
functions/onMemoryWritten.js (auto communities), functions/index.js, cleanupDeletedUser   Tasks 4–6
mobile/src/domain/{profiles,communities,profanity}.ts (+tests)                  Task 2
mobile/src/data/types.ts, data/memory/*, data/firestore/*, test/contracts/*      Tasks 7–8
mobile/src/features/{profile,people,inbox,communities,transfers,institutions,safety,aura}/*   Tasks 9–15
mobile/app/(app)/{notifications,communities/index,communities/[id],institutions/index,institutions/[id],blocked}.tsx
```

---

### Task 1: Domain helpers — profiles, communities, profanity

**Files:** Create `mobile/src/domain/{profiles,communities,profanity}.ts` + tests; Create `functions/lib/domain.js` (CommonJS mirror of the community bucket and normalization helpers) + test against the same fixture JSON `fixtures/domain/communities.json` (written by the TS test step and committed).

**Interfaces — Produces:**
- `normalizeName(s: string): string`: trims, collapses whitespace, NFKD, strips combining marks, lowercases.
- `validateDisplayName(s): string | null`: 2–40 chars after trim, else `Use 2 to 40 characters.`.
- `searchRange(q): { start: string; end: string } | null`: null when `normalizeName(q).length < 2`; `end = start + ''`.
- `yearCommunity(createdAt: Date): { id: 'time-<y>'; name: '<y> Memories' }` and `eraCommunity(createdAt): { id: 'era-<d>s'; name: '<d>s Era' }`. Both use UTC years.
- `geoCommunity(place: { id; name }): { id: 'geo-<placeId>'; name: '<name> Circle' }`. `GEO_THRESHOLD = 5`.
- `containsProfanity(text): boolean`: whole-word match against a list in `profanity.ts` (≤ 60 common English slurs/obscenities plus their leetspeak variants). Case- and diacritic-insensitive.

- [x] **Step 1: Failing tests:**
  - `normalizes names for search`: `'  Ánna  Bell '` → `'anna bell'`; emoji kept; `searchRange('a')` → null; `searchRange('An')` → `{start:'an', end:'an'}`.
  - The bucket ids and names for 1999-12-31T23:59Z (UTC) → `time-1999` and `era-1990s`.
  - Profanity whole-word: `'class'` is not flagged; a listed word is flagged.
  - The functions mirror produces identical output on `communities.json`.
- [x] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** gates → PASS.
- [x] **Step 5: Commit** `feat(domain): profile, community and profanity helpers`.

---

### Task 2: Rules for Plan 3 (+ indexes)

**Files:** `firestore.rules`, `firestore.indexes.json`, `rules_test/*`.

**Rules:**
- `publicProfiles/{uid}`: read `signedIn()`. Create and update only `isSelf(uid)` with exactly the keys `displayName`, `displayNameLower` and `updatedAt`. `displayName` is a string, 2–40 chars. `displayNameLower` is a string. Delete `false`.
- `users/{uid}`: owner-only read (already done in the Plan 2 fix wave). The owner may write `notificationPrefs` (map of three bools) and `acceptedTermsAt` (string) alongside existing fields.
- `users/{uid}/notifications/{id}`: read `isSelf`. Update `isSelf` and `affectedKeys().hasOnly(['readAt'])`. Create and delete `false`.
- `users/{uid}/blocks/{other}`: read and write `isSelf`. Create data `{createdAt: string}` only, and `other != uid`.
- `communities/**`, `transfers/{id}`, `institutions/{id}`: reads as follows; client writes `false`.
  - Communities: `signedIn()`.
  - Members: member or self.
  - Transfers: from/to user.
  - Institutions: `signedIn()`.
- `reports`, `rateLimits`, `notificationRequests`: all client access `false`.
- `memories`:
  - `isVisibleMemory` adds `&& memory.moderation != 'hidden'` for non-authors. The own-read clause is unchanged, so authors still read hidden memories.
  - Create requires `moderation == null` (field present).
  - `moderation` and `flags` are not in any mutable list.
- Indexes: `publicProfiles.displayNameLower ASC`; `transfers (toUserId, status, createdAt desc)` and `(fromUserId, createdAt desc)`; `communities (memberCount desc)`; `members` collection group on `userId` (if used); `notifications (createdAt desc)`; memories `moderation` equality in the five visibility queries.

- Carried from Plan 2 final review (ruling R18):
  - Media URL rule accepts only `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/memory-(images|audio)%2F<uid>%2F...` plus emulator hosts `http://(127.0.0.1|localhost):9199`. Generate `firestore.rules` from `firestore.rules.template` with the real bucket name (`scripts/build-rules.js`, reads `FIREBASE_STORAGE_BUCKET`, default `demo-echoes.appspot.com`). Generate `firestore.lan.rules` (used by `firebase.lan.json`) that additionally allows private-LAN `http://…:9199`. Add a test that the two generated files differ only in the storage-prefix function. Document `adb reverse tcp:9199 tcp:9199` as the alternative.
  - `places`: client create only with `memoryCount == 0`, `publicMemoryCount == 0`, empty aura (`memoryCount == 0`, `intensity == 0`), `communityId == null`, `custodianIds == [request.auth.uid]`. Client update denied entirely, because only functions update places (transfers are server-side now).
  - `docs/release-readiness.md`: note that deploying these rules retires the legacy Flutter client.
- [x] **Step 1: Failing rules tests** for every bullet: allowed and denied pairs, including a stranger writing someone else's publicProfile, a client creating a member doc, a client creating a notificationRequest, a client setting `moderation`, a non-author reading a hidden memory (denied) and the author reading it (allowed), marking a notification read (allowed), and changing its title (denied).
- [x] **Step 2: Run** `npx firebase emulators:exec --only firestore,storage "npm test --prefix rules_test"` → FAIL. **Step 3: Change rules + indexes.** **Step 4: Run** → PASS; run the emulator contract suite too (it must stay green; fix client queries to add the `moderation == null` filter if needed — see Task 7).
- [x] **Step 5: Commit** `feat(rules): read-only social collections, public profiles, inbox, moderation`.

---

### Task 3: Callable infrastructure (functions)

**Files:** Create `functions/lib/{callable,rateLimit,notify,blocks}.js` + tests.

**Interfaces — Produces:**
- `callable(name, { schema, rateLimit?: {action, perDay} }, handler)`: wraps `onCall` with auth check, schema validation (small hand-rolled validator, no new deps), rate limit and error mapping. Unexpected errors become `HttpsError('internal')` and are logged.
- `assertNotBlocked(db, a, b)`: checks `users/{a}/blocks/{b}` and `users/{b}/blocks/{a}`.
- `notify(db, { to, type, title, body, data, actorId })`:
  - Skips if `to === actorId`, if either side has blocked the other, or if the recipient's matching pref is false (`memoryTagged`→`tags`; `transfer*`→`transfers`; `communityInvite`→`communityInvites`; missing prefs mean true).
  - Writes `users/{to}/notifications/{auto}` with `readAt: null` and `createdAt` as an ISO string.
  - Name lookups use `publicProfiles`, falling back to `Someone`.
- `incrementRateLimit(db, uid, action, perDay, now)`: transactional, throws `resource-exhausted`.

- [x] **Step 1: Failing tests** with a fake Firestore (in-memory, supporting the used subset):
  - unauthenticated → `unauthenticated`; bad input → `invalid-argument`;
  - the 21st report in a day → `resource-exhausted`;
  - notify skips self, blocked users and disabled prefs;
  - notify fills in names.
- [x] **Step 2–4:** FAIL → implement → PASS (`npm test --prefix functions`).
- [x] **Step 5: Commit** `feat(functions): callable, rate-limit, block and notify helpers`.

---

### Task 4: Functions — communities and tag notifications

**Files:** Create `functions/communities.js`, `functions/tags.js` + tests; Modify `functions/onMemoryWritten.js` (auto communities), `functions/index.js`.

**Behaviour:**
- `createCommunity({name, description})`:
  - Thematic. Name 1–60 and description 1–500 chars after trim.
  - Owner membership with `memberCount: 1`. Returns `{id}`.
  - Rate limit 10/day.
- `joinCommunity({communityId})` is idempotent:
  - It creates `members/{uid}` with role `member` and increments `memberCount` in a transaction.
  - It also adds the id to `users/{uid}.communityIds` (arrayUnion).
- `leaveCommunity({communityId})`:
  - Owner → `failed-precondition`.
  - Deletes the member doc, decrements the count, and runs arrayRemove on `communityIds`. Idempotent.
- `inviteToCommunity({communityId, userIds[≤20]})`:
  - The caller must be a member.
  - Calls `notify` with type `communityInvite` for each invitee, respecting blocks. Rate limit 50/day.
- `onMemoryWritten`, on create only:
  - Ensures `time-<y>` and `era-<d>s` exist (owner = author, type `timeBased`) and auto-joins the author to the year community.
  - When the place's `publicMemoryCount` reaches `GEO_THRESHOLD`, creates `geo-<placeId>` (owner = first custodian) and sets `place.communityId`.
  - All idempotent.
- `onMemoryCreatedTags` (`onDocumentCreated('memories/{id}')`): for each `taggedUserIds` entry (deduped, excluding the author and blocked users), sends `notify` of type `memoryTagged`.

- [x] **Step 1: Failing tests:**
  - create/join/leave/invite happy paths and errors;
  - join twice → count 1;
  - owner leave → `failed-precondition`;
  - **`blocked users cannot tag, invite or transfer`** (the invite and tag parts here; the transfer part in Task 5);
  - auto communities created once over repeated triggers;
  - geo at exactly 5;
  - the tag trigger notifies each tagged user once, skips the author.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(functions): communities and tag notifications`.

---

### Task 5: Functions — custodianship transfers

**Files:** Create `functions/transfers.js` + tests; Modify `functions/index.js`.

**Behaviour:**
- `initiateTransfer({placeId, toUserId})`:
  - The caller must be a custodian. `toUserId` must not be the caller and must have a publicProfile.
  - Not blocked; no pending transfer for the same (place, to) (else `already-exists`).
  - Creates the transfer (`revokeUntil = createdAt + 7 d`) and calls `notify` with type `transferRequest`. Rate limit 20/day.
- `respondToTransfer({transferId, accept})`:
  - The caller must be `toUserId` and the status must be `pending` (accepting an accepted transfer is idempotent → returns ok).
  - In a transaction: if the place no longer exists → `failed-precondition`.
  - On accept, runs arrayUnion of the recipient into `custodianIds` and sets `status`/`respondedAt`.
  - Notifies the sender with `transferAccepted` or `transferRejected`.
- `revokeTransfer({transferId})`:
  - The caller must be `fromUserId` and `now <= revokeUntil`; status must be `pending` or `accepted`.
  - If accepted, runs arrayRemove of the recipient from `custodianIds`, unless they were a custodian before the transfer (record `recipientWasCustodian` at accept).
  - Sets `revoked`.
- `expireTransfers` = `onSchedule('every 24 hours')`: pending with `createdAt` older than 7 d → `expired`. Paginated, `timeoutSeconds: 540`.
- `cleanupDeletedUser`: also deletes `publicProfiles/{uid}`, removes the uid from `institutions.adminUserIds`, and deletes `reports` by the reporter (keep reports *about* their memories — memories are deleted anyway).

- [x] **Step 1: Failing tests:**
  - happy path; self-transfer; non-custodian; duplicate pending → `already-exists`;
  - **`accept after place deleted fails cleanly`**; **`accept is idempotent`** (no duplicate custodian);
  - revoke before and after 7 d; revoke of an accepted transfer removes the custodian;
  - blocked transfer refused; expiry job; cleanup additions.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(functions): custodianship transfers`.

---

### Task 6: Functions — institutions and safety

**Files:** Create `functions/institutions.js`, `functions/safety.js` + tests; Modify `functions/index.js`.

**Behaviour:**
- `createInstitution({name, allowedEmailDomains[1..10]})`:
  - Requires `request.auth.token.staff === true`.
  - Domains are lowercase, trimmed and validated with a hostname regex.
  - Creates the institution (no admins yet) and its community `inst-<id>` (type `institution`, owner = staff caller).
- `claimInstitutionAdmin({institutionId})`:
  - Requires `token.email_verified === true` (else `failed-precondition` → `Verify your email address first.`).
  - The email domain must exactly equal (case-insensitive) one allowed domain (else `permission-denied` → `Your email domain isn't approved for this institution.`).
  - arrayUnion into `adminUserIds`; joins the institution community as `guardian`.
- `addInstitutionSubZone({institutionId, name, latitude, longitude, radiusMeters=60})`: admin only. Validates ranges; appends `{id, ...}`.
- `reportMemory({memoryId, reason, note?})`:
  - The memory must be visible to the reporter (re-check with the same visibility logic server-side) and not the reporter's own (`failed-precondition`).
  - One report per (memory, reporter) via doc id `<memoryId>_<uid>` (else `already-exists`). Rate limit 20/day.
  - In a transaction, counts distinct reports. At 3, sets `memories/{id}.moderation = 'hidden'` (once).
- `onMemoryWritten`/create: if `containsProfanity(textContent)` (mirror in functions/lib/domain.js), set `flags: { profanity: true }` via Admin SDK.

- [x] **Step 1: Failing tests:**
  - staff-only create; **`rejects subdomain and unverified email`**; exact-domain success;
  - sub-zone by a non-admin denied;
  - **`three distinct reporters hide once`**; **`duplicate reporter does not count`**;
  - a reporter can't report their own memory or a memory not visible to them;
  - the profanity flag set.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(functions): institutions, reporting and auto-hide`.

---

### Task 7: Client data layer — profiles, inbox, blocks, reports, moderation

**Files:** Modify `mobile/src/data/types.ts`, `mappers.ts`, `data/memory/*`, `data/firestore/*` (+ `firebase/functions` `httpsCallable`, `connectFunctionsEmulator` in `services/firebase.ts`), contracts, emulator test, `data/errors.ts`.

**Interfaces — Produces:**
```ts
interface PublicProfile { id: string; displayName: string }
interface ProfileRepository { get(uid): Promise<PublicProfile|null>; getMany(uids: string[]): Promise<Map<string, PublicProfile>>; search(query: string, opts: { excludeUid?: string }): Promise<PublicProfile[]>; setDisplayName(uid: string, name: string, at: Date): Promise<void> }
interface AppNotification { id: string; type: 'memoryTagged'|'transferRequest'|'transferAccepted'|'transferRejected'|'communityInvite'; title: string; body: string; data: Record<string,string>; createdAt: Date; readAt: Date | null }
interface NotificationRepository { subscribe(uid, cb, onError?): Unsubscribe; markRead(uid, id, at): Promise<void>; markAllRead(uid, at): Promise<void> }
interface SafetyRepository { block(uid, other, at): Promise<void>; unblock(uid, other): Promise<void>; subscribeBlocks(uid, cb, onError?): Unsubscribe; reportMemory(input: { memoryId: string; reason: ReportReason; note: string | null }): Promise<void> }
interface UserRepository { updateNotificationPrefs(uid, prefs: NotificationPrefs, at): Promise<void> }   // + acceptTerms handled at register
AuthRepository.register(email, password, displayName, acceptedTermsAt: Date)   // also writes publicProfile
Memory gains `moderation: 'hidden' | null`; visibility queries filter `moderation == null` for non-own branches; isMemoryVisibleTo treats hidden as invisible to non-authors.
mapCallableError(e): Error   // HttpsError code → spec copy (already-exists/duplicate etc. per call site), never raw
```
Memory backend emulates notifications (including tag notifications on memory create) and report auto-hide in-process.

- [x] **Step 1: Failing contract cases** (memory + emulator):
  - profile set/get/search (case/diacritic-insensitive, excludes self, `limit 10`, null for < 2 chars);
  - notifications appear for tagged users and markRead works;
  - block/unblock list;
  - report thrice → hidden for others, visible to author; duplicate report → error copy;
  - register writes publicProfile + acceptedTermsAt.
- [x] **Step 2–4:** FAIL → implement → PASS (unit + emulator).
- [x] **Step 5: Commit** `feat(data): profiles, inbox, blocks, reports, moderation`.

---

### Task 8: Client data layer — communities, transfers, institutions, aura history

**Files:** same areas as Task 7.

**Interfaces — Produces:**
```ts
interface Community { id; name; description; type: 'geographic'|'thematic'|'timeBased'|'institution'; ownerId; placeId: string|null; institutionId: string|null; memberCount: number; createdAt; updatedAt }
interface CommunityRepository { subscribeMine(uid, cb, onError?): Unsubscribe; subscribeDiscover(cb, onError?): Unsubscribe /* memberCount desc, ≤50 */; findById(id): Promise<Community|null>; subscribeMembership(id, uid, cb): Unsubscribe; subscribeFeed(id, viewer: { viewerId; viewerCommunityIds; now }, cb, onError?): Unsubscribe; create(input: { name; description }): Promise<string>; join(id): Promise<void>; leave(id): Promise<void>; invite(id, userIds: string[]): Promise<void> }
interface Transfer { id; placeId; fromUserId; toUserId; status: 'pending'|'accepted'|'rejected'|'revoked'|'expired'; createdAt; respondedAt: Date|null; revokeUntil: Date }
interface TransferRepository { initiate(input: { placeId; toUserId }): Promise<void>; respond(id, accept: boolean): Promise<void>; revoke(id): Promise<void>; subscribeIncoming(uid, cb, onError?): Unsubscribe; subscribeHistory(uid, cb, onError?): Unsubscribe }
interface Institution { id; name; allowedEmailDomains: string[]; adminUserIds: string[]; subZones: SubZone[]; communityId: string|null }
interface InstitutionRepository { subscribeAll(cb, onError?): Unsubscribe; findById(id); create(input: { name; allowedEmailDomains: string[] }): Promise<string>; claimAdmin(id): Promise<void>; addSubZone(id, input: { name; latitude; longitude }): Promise<void> }
PlaceRepository.subscribeAuraHistory(placeId, cb, onError?): Unsubscribe   // ≤14 newest
AuthRepository: sendEmailVerification(): Promise<void>; refreshUser(): Promise<{ email: string; emailVerified: boolean; staff: boolean }>
```

- [x] **Step 1: Failing contract cases:**
  - community create/join/leave/invite/feed (community-privacy memory visible to members only);
  - auto year community appears in `subscribeMine` after a memory create (poll);
  - transfers full flow incl. revoke and duplicate pending error;
  - institution create (memory backend: staff flag on the test identity; emulator: custom claim via Auth emulator REST);
  - claimAdmin with verified/unverified email (emulator: set `emailVerified` via Auth emulator REST);
  - aura history emits entries after memory writes.
- [x] **Step 2–4:** FAIL → implement → PASS (unit + emulator).
- [x] **Step 5: Commit** `feat(data): communities, transfers, institutions, aura history`.

---

### Task 9: People — display names, search, tagged privacy

**Files:**
- Create `mobile/src/features/people/{UserSearchField,useAuthorNames}.tsx` + tests.
- Modify `PrivacyPicker.tsx` (Tagged and Community segments), `AddMemoryScreen`, `EditMemoryScreen`, `MemoryCard`, `MemoryDetailScreen` (author display name), `ProfileScreen` (`Display name` editor), `SignInScreen` (terms checkbox with links).

**Behaviour:**
- `UserSearchField`:
  - 300 ms debounce. Shows `Type at least 2 letters.` under 2 chars, and `No people found.` when empty.
  - Excludes self and blocked users. Selected users appear as removable chips with display names.
- `useAuthorNames(ids)` batches `profiles.getMany` with a session cache.
- Community segment lists my communities (`Choose a community`, empty `Join a community first.`).
- Registration requires the terms checkbox. The links open `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_GUIDELINES_URL` (defaults per ADR-0008) via `expo-web-browser` or `Linking`.

- [x] **Step 1: Failing tests:**
  - **`requires two characters`**; debounce (fake timers); picking adds a chip; tagged memory saves `taggedUserIds`;
  - community privacy saves `communityId`;
  - display name validation copy; author names render;
  - registration blocked without terms → exact error copy.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(people): names, search, tagged and community privacy, terms`.

---

### Task 10: Notifications inbox + settings

**Files:**
- Create `mobile/src/features/inbox/{InboxScreen,useInbox,InboxBell}.tsx` + tests and `mobile/app/(app)/notifications.tsx`.
- Modify `MapScreen` (bell with unread badge) and `ProfileScreen` (Notifications toggles).

**Behaviour:**
- List newest first. Unread rows are emphasised.
- Tapping marks a row read and navigates: `memoryTagged` → `/memory/{memoryId}`; `transfer*` → transfer actions (Task 12 adds Accept/Decline inline for `transferRequest`); `communityInvite` → `/communities/{communityId}`.
- `Mark all read`. Empty `You're all caught up.`
- Badge shows the unread count (9+ cap).
- Settings toggles persist `notificationPrefs`.

- [x] **Step 1: Failing tests:** list and order; tap marks read and navigates; badge count; toggles persist; empty state.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(inbox): in-app notifications and preferences`.

---

### Task 11: Communities screens

**Files:** Create `mobile/src/features/communities/{CommunitiesScreen,CommunityScreen,CreateCommunitySheet}.tsx` + tests and `mobile/app/(app)/communities/{index,[id]}.tsx`; Modify `MapScreen`/`ProfileScreen` (entry point `Communities`).

**Behaviour:** Copy per spec.
- `Mine | Discover`.
- Detail: header, type badge, member count, `Join`/`Leave` (owner can't leave; confirm dialog), `Invite` (UserSearchField multi-select → `invite`), feed of community memories (MemoryCard; blocked authors hidden).
- Create sheet with validation.
- Callable errors are mapped; offline → timeout copy.

- [x] **Step 1: Failing tests:** lists; join/leave flows incl. owner block and confirm; invite sends; create validation and success navigates to the new community; feed visibility; **`hides blocked authors' memories on place and community feeds`** (also covers PlaceScreen).
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(communities): browse, join, leave, invite, create, feed`.

---

### Task 12: Custodianship transfer UI

**Files:** Create `mobile/src/features/transfers/{TransferSheet,TransferHistory,useTransfers}.tsx` + tests; Modify `PlaceScreen` (action for custodians), `InboxScreen` (Accept/Decline for `transferRequest`), `ProfileScreen` (`Places you look after`, `Transfer history` with `Revoke` until `revokeUntil`).

- [x] **Step 1: Failing tests:**
  - custodian-only action; send request → `Request sent.`; duplicate copy;
  - Accept/Decline from the inbox update status;
  - Revoke visible only while `now <= revokeUntil` → `Transfer revoked.`;
  - non-custodian sees no action.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(transfers): request, accept, decline, revoke`.

---

### Task 13: Institutions UI + safety UI

**Files:**
- Create `mobile/src/features/institutions/{InstitutionsScreen,InstitutionScreen}.tsx` + tests and `mobile/src/features/safety/{ReportSheet,useBlocks,BlockedScreen}.tsx` + tests.
- Create routes `institutions/{index,[id]}.tsx` and `blocked.tsx`.
- Modify `MemoryDetailScreen` (`Report`, `Block {name}` for non-authors; `Hidden after reports` badge for authors), `AddMemoryScreen`/`EditMemoryScreen` (profanity confirm), and every memory list (`PlaceScreen`, community feed, profile lists): filter blocked authors.

**Behaviour:**
- Copy per spec.
- `Register institution` is shown only when `refreshUser().staff`.
- The `Verify as admin` flow covers unverified, mismatch and success. `Send verification email` → toast. A refresh on focus re-checks verification.
- `Add sub-zone here` uses the current location.
- Report sheet: reasons, optional note (≤280), duplicate/rate copy.
- Block confirm; Blocked people list with `Unblock`.
- Profanity: `containsProfanity` → `Alert` with `Edit` / `Save anyway`.
- Profile gets `Help & support` (mailto), `Terms of Service` and `Community Guidelines` links.

- [x] **Step 1: Failing tests:**
  - staff gating; the three claim outcomes; sub-zone add;
  - report flows incl. duplicate and rate copy; block hides content immediately; unblock restores;
  - hidden badge for the author; profanity confirm both branches;
  - support/terms links call `Linking.openURL` with configured values.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(safety): institutions, report, block, hide, profanity check`.

---

### Task 14: Aura history chart

**Files:** Create `mobile/src/features/aura/AuraHistoryChart.tsx` + test (install `react-native-svg` via `npx expo install`); Modify `PlaceScreen`.

**Behaviour:**
- Heading `Aura history`, shown only with ≥ 2 entries.
- Oldest → newest bars, height ∝ intensity, colour = entry `colorHex`.
- Accessible summary `accessibilityLabel` = `Aura history: {first category} to {last category} over {n} updates`.

- [x] **Step 1: Failing tests:** hidden with < 2 entries; bar count equals entries; label text. **Step 2–4:** FAIL → implement → PASS (+ android export).
- [x] **Step 5: Commit** `feat(aura): history chart on place screen`.

---

### Task 15: Plan 3 verification

**Files:** Modify `status.md` (Plan 3 section on top), `README.md` (features, staff claim instructions: `firebase auth:import`/Admin SDK snippet to set `staff` custom claim; Terms/Guidelines/support env vars).

- [x] **Step 1: Run every gate** (all exit 0):
  - `npm --prefix mobile test` three times, plus `--randomize`;
  - typecheck and lint;
  - `npm test --prefix functions`;
  - emulator contracts (`--only auth,firestore,storage,functions`);
  - rules tests (`--only firestore,storage`);
  - expo export for android and ios.
- [x] **Step 2: Update `status.md`** with the gate table, a manual Expo Go checklist for every Plan 3 flow, and known follow-ups (push delivery in Plan 4; staff review UI; Terms/Guidelines page content).
- [x] **Step 3: Commit** `docs: record Expo Plan 3 verification`.

---

## Execution rulings (from the SDD ledger)

- Ruling R19: Task 2 may add `moderation == null` to client visibility queries only if needed to keep the emulator suite green (minimal), otherwise Task 7 owns it — cost if wrong: none.
- Ruling R20: move `useBlocks` (subscribeBlocks hook) and the blocked-author filter into Task 9 (People), so Task 11's "hides blocked authors" test can rely on it; Task 13 keeps block/unblock UI + BlockedScreen — cost if wrong: small task re-scope.
- Ruling R21: Task 6 adds `functions/lib/profanity.json` (copy) + containsProfanity in functions/lib/domain.js, with a functions test asserting the copy equals fixtures/domain/profanity.json; Task 3 un-ignores functions/lib/*.js in functions/.gitignore — cost if wrong: a synced copy to maintain.
- Ruling R22: strip only Latin combining diacritics U+0300–U+036F in both mirrors, with fixtures for an Indic name and a kana name; drop high-false-positive words (dick, cock, cum, fag) from the profanity list since it is warn-only — cost if wrong: accented non-Latin scripts outside that block keep marks (correct behaviour).
- Ruling R23: Task 3 adds `onPublicProfileWritten` (Admin) that recomputes `displayNameLower = normalizeName(displayName)` and overwrites if mismatched — rules can't normalise — cost if wrong: one extra trigger write on profile edits.
- Ruling R24: tag cap MAX_TAGS = 20 (rules + client + trigger; copy `You can tag up to 20 people.`); member docs include `userId` (functions write it) with a `fieldOverrides` COLLECTION_GROUP index on members.userId, and cleanupDeletedUser's members cleanup is fixed in Task 3 — cost if wrong: cap may feel low for big groups.
- Ruling R25: auto communities (timeBased, geographic, institution) have ownerId 'system' (all human members incl. author are 'member'/'guardian' and may leave); on account deletion, thematic communities owned by the user transfer ownership to the earliest-joined remaining member (role owner), deleted only if no members remain; memories shared with a deleted community stay author-visible (acceptable) — cost if wrong: 'system' needs special-casing in UI (no owner name).
- Ruling R26: leaving a community is sticky for auto-join — leaveCommunity arrayUnions the id into users/{uid}.leftCommunityIds; auto-join skips ids in that list; explicit joinCommunity arrayRemoves it — cost if wrong: one more user field.
- Ruling R27: invite rate limit counts invitees: 200 invitees/day (consume N units per call) — cost if wrong: power users may hit it.
- Ruling R28: Task 7 fix round runs after Task 8 lands (same files) and centralises callable invocation in one helper: callable timeout 15 s, offline (connectivity.isOnline() false) or deadline-exceeded/unavailable → TIMEOUT_ERROR, applied to ALL callables (Task 7 + Task 8); folds minor 2 (control chars in names) and 4 (markRead errors mapped). Profile-repair-on-session-start → Task 9 — cost if wrong: slight delay to Task 7 completion.
- Ruling R29: accept Task 11's extra copy (type badges Place/Interest/Time/Institution, `Owned by {name}`, empty/error/not-found, invite sheet `Invite to {name}` / `Send invitations` / `Invitations sent.`) and add invite-context copy `You can invite up to 20 people at a time.` + `Remove invited person` via UserSearchField props in the final fix wave — cost if wrong: copy edits.
- Ruling R30: replace mobile/metro.config.js watchFolders with a synced copy `mobile/src/domain/profanity.json` + Jest byte-equality test against fixtures/domain/profanity.json (same pattern as functions) — builds must not depend on files outside mobile/ — cost if wrong: one more synced copy.
- Ruling R31: Final fix wave = client C1..C8 + backend B1..B9; everything else in the two findings files is deferred to Plan 5 (listed there) — public-launch blockers are moderation integrity, spam fan-out, data growth (TTL fields) and deletion reliability; the rest is hardening — cost if wrong: Plan 5 picks them up anyway.
- Ruling R32: Tag-notification budget 100/author/day, silent skip — mirrors invite budget 200/day scale and avoids leaking limits to tagger; cost if wrong: a prolific legit author's tags beyond 100/day don't notify (inbox only, memory still tagged).
- Final fix wave backend: DONE_WITH_CONCERNS 21dabd1 (functions 238). Ruling R33: tag budget consumed pre-notify (incl. blocked/pref-skipped/retries) accepted — conservative for spam; cost: slightly fewer legit notifications for very heavy taggers. Ruling R34: history change check on aura fields only accepted — history stores aura. Concern 1 (expireAt vs rules/client) → client wave verifies mapper tolerance; re-run rules + emulator in re-review gate.

## Final review

Final whole-branch review (backend + client, opus): Ready after fixes. Fix wave 21dabd1 (backend B1–B9: hidden-aware aggregates and recompute gating, tag-notification budget 100/day, idempotent invite notifications, TTL expireAt on rateLimits/notifications, transfer block-probe ordering, time-community year bound, cleanup timeout/retry, runbook) and 602a173 (client C1–C9: invite copy, invite double-submit guard, offline timeouts on name/block/unblock, inbox load error, mark-all-read guard, copy single-sourcing, a11y headers/labels). Re-review: Approved. Gates after the wave: functions 238, mobile 769/55, tsc and eslint clean, rules 44. Deferred to Plan 5: see docs/release-readiness.md and the Plan 5 backlog (report brigading, reporting community/display names, publicProfiles list limit, adminUserIds privacy, hot memberCount docs, names in others' inboxes after deletion, visibility.js own-read clause, time-release tag notifications, live-region Notice component, BlocksProvider, map top-row crowding, chart contrast, partial-registration repair).
