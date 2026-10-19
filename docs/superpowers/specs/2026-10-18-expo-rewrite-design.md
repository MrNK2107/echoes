# ECHOES Expo Rewrite — Design

**Date:** 2026-10-18
**Status:** Approved by owner ("rewrite with expo")
**Supersedes (client only):** `2026-05-27-echoes-complete-implementation-design.md`
**Decisions:** `docs/adr/0001`–`0005`

## Goal
Replace the Flutter client with a React Native + Expo (SDK 58) client that runs in
Expo Go with zero setup, talks to the **unchanged** Firebase backend and data
schema, and reaches feature parity with the Flutter v1 in five plans.

## Product (unchanged, see `SPEC.md`)
Place-based memories: users attach text (+ photo, voice) to their GPS location; the
nearest place within **100 m** receives it, otherwise a new place named
`Memory Place` is created with the author as custodian. Each place shows an aura
derived from the sentiment of its public memories. Five privacy modes govern who
sees a memory.

## Repository layout
```
echoes/
  mobile/            NEW Expo app (this rewrite)
  fixtures/domain/   NEW golden JSON exported from the Dart domain code
  functions/         Cloud Functions (gains onMemoryWritten, ADR-0003)
  rules_test/        unchanged
  firestore.rules, storage.rules, firestore.indexes.json, firebase.json
  lib/, test/, android/, ios/ …  Flutter client — frozen; deleted in Plan 5
```

## Client architecture (`mobile/src`)
```
domain/      pure TS: types, privacy, sentiment, geohash, geo, aura   (no imports from RN/Firebase)
data/
  <entity>/types.ts        repository interface
  <entity>/memory.ts       in-memory implementation
  <entity>/firestore.ts    Firestore implementation
  <entity>/mappers.ts      Firestore doc <-> domain
  seed.ts                  demo data for memory mode
device/      location + image picker interfaces, expo + fake impls
services/    config.ts (backend mode), createServices.ts, ServicesProvider.tsx
features/    auth/, map/, memories/ — hooks + components per feature
app/         expo-router routes (thin: compose feature components)
```
Dependency rule: `domain` ← `data`/`device` ← `services` ← `features` ← `app`.

## Data contract (must match existing Firestore docs exactly)
| Collection | Fields | Date encoding |
|---|---|---|
| `memories/{id}` | userId, placeId, imageUrl?, audioUrl?, textContent, latitude, longitude, geohash, sentiment{compound,positive,neutral,negative}, privacy (`public`\|`private`\|`tagged`\|`timeRelease`\|`community`), taggedUserIds[], communityId?, releaseDate?, isDeleted, deletedAt?, createdAt, updatedAt | **Firestore Timestamp** |
| `places/{id}` | name, latitude, longitude, geohash, communityId?, custodianIds[], aura{dominantSentiment,compoundScore,intensity,memoryCount,colorHex,updatedAt}, memoryCount, publicMemoryCount, createdAt, updatedAt | **ISO-8601 UTC string** |
| `users/{id}` | displayName?, email?, photoUrl?, defaultPrivacy, managedPlaceIds[], communityIds[], createdAt, updatedAt | **ISO-8601 UTC string** |
| Storage | `memory-images/{uid}/{memoryId}.jpg` (≤ 1 MiB, image/*), `memory-audio/{uid}/{memoryId}.m4a` (≤ 5 MiB) | — |

Readers must also accept ISO strings for memory dates (older docs) — backward
compatibility the Dart DTO already provides.

## Domain rules (oracle = `fixtures/domain/*.json`, Dart exporters in git history)
- **Visibility** (`Memory.isVisibleTo`): deleted → hidden; author → visible; else
  public → yes, private → no, tagged → viewer in taggedUserIds, timeRelease →
  releaseDate set and `now >= releaseDate`, community → viewer is member.
- **Sentiment**: VADER-style lexicon analyzer, `lib/features/aura/data/lexicon_sentiment_analyzer.dart`.
  Category thresholds: pos≥0.35 && neg≥0.35 → mixed; compound≥0.35 positive;
  ≥0.1 peaceful; ≤−0.35 heavy; else neutral.
- **Aura**: weight = 1/(1+ageDays/30); score = weighted mean compound; mixed if any
  compound≥0.1 and any ≤−0.1, else thresholds as above on score; intensity =
  min(n/20, 1). Colors: positive `#FFB347`, peaceful `#77B5FE`, heavy `#9B59B6`,
  mixed `#DDA0DD`, neutral `#C0C0C0`. Input = non-deleted **public** memories.
- **Geohash**: base32 `0123456789bcdefghjkmnpqrstuvwxyz`, default precision 9.
- **Nearby prefix precision**: r≤100→7, ≤500→6, ≤4000→5, else 4. Distance = haversine, R = 6 371 000 m.
- Map radius **1500 m**; place match radius **100 m**; list limits **50**.

## Validation copy (verbatim from Flutter)
- Email: `Email is required` / `Enter a valid email` (must contain `@` and `.`)
- Password: `Password is required` / `Use at least 8 characters`
- Name: `Name is required`
- Age: checkbox `I confirm that I am at least 13 years old.`; error `You must be at least 13 to create an account.`
- Memory text 1–2000 chars after trim.
- Privacy errors: `Add at least one tagged user.`, `Choose a release date.`,
  `Choose a future release date.`, `Choose a community.`, location missing:
  `Capture location before saving.`

## Visual baseline
Dark theme: background `#0D1117`, surface `#161B22`, elevated `#21262D`, accent
`#58A6FF`, gold `#F0B429`, text `#F0F6FC` / secondary `#8B949E`.

## Plan 2 decisions (2026-10-19)
Fixes to Flutter gaps found while porting:
- **Recently deleted** — authors can read their own soft-deleted memories (rules change) and restore within **30 days** (`RESTORE_WINDOW_DAYS = 30`, already enforced by `restoreOnly` in rules). A daily scheduled function `purgeDeletedMemories` hard-deletes memories whose `deletedAt` is older than 30 days, plus their Storage files.
- **Offline outbox** — ADR-0006 replaces Plan 1's single-flight retry.
- **Voice notes** — `expo-audio`, max **60 s**, AAC `.m4a`, `contentType 'audio/mp4'`, Storage `memory-audio/{uid}/{memoryId}.m4a` (≤ 5 MiB). Rules gain `audioUrl` in the mutable field list so a queued voice note can be attached later.
- **Account deletion** — requires the current password (re-authentication) and states accurately that all of the user's memories, photos and voice notes are deleted (that is what `cleanupDeletedUser` does).
- **Edit** — text and privacy (Public / Private / Time release) are editable; the same validation as Add (future release date required).

Copy (exact):
- Delete confirm: title `Delete this memory?`, body `You can restore it from Recently deleted for 30 days.`, buttons `Cancel` / `Delete`.
- Edit: title `Edit memory`, button `Save changes`.
- Recently deleted: title `Recently deleted`, row `Restorable for {n} days` / `Restorable for 1 day`, button `Restore`, empty `Nothing here. Deleted memories stay restorable for 30 days.`, expired `This memory can no longer be restored.`
- Voice: `Record voice note`, `Stop`, `Remove voice note`, `Recording {s}s / 60s`, `Voice note ready ({s}s)`, mic denied `Microphone permission is needed for voice notes.`; player `Play voice note` / `Pause voice note`, label `Voice note`, error `Voice note unavailable`.
- Outbox: after queueing `Saved offline. It will upload when you're back online.`; banner `{n} memory waiting to upload` / `{n} memories waiting to upload`, button `Retry`.
- Outbox permanent failures (ruling R14): banner `{n} memory couldn't upload` / `{n} memories couldn't upload`, button `Discard`; confirm title `Discard memories that couldn't upload?`, body `They can't be recovered.`, buttons `Cancel` / `Discard`.
- Profile: title `Profile`, name fallback `ECHOES custodian`, stat `Memories`, setting `Default privacy for new memories` (Public / Private), section `Your memories`, empty `No memories yet.` / `Memories you leave will appear here.`, buttons `Recently deleted`, `Sign out`, `Delete account`. Map header button accessibilityLabel `Profile`.
- Delete account: title `Delete account`, body `This permanently deletes your account, your profile, and every memory, photo and voice note you created. This cannot be undone.`, field `Confirm your password`, buttons `Cancel` / `Delete permanently`, wrong password `Incorrect password.`

## Plan 3 decisions (2026-10-19) — social, notifications inbox, safety
See ADR-0007 (server-authoritative social operations) and ADR-0008 (safety).

Data (all dates ISO strings unless noted; server-written unless noted):
- `publicProfiles/{uid}`: `displayName`, `displayNameLower`, `updatedAt` — owner writes; displayName 2–40 chars trimmed.
- `users/{uid}` gains `acceptedTermsAt`, `notificationPrefs { transfers: true, tags: true, communityInvites: true }` (owner writes). Owner-only reads.
- `users/{uid}/notifications/{id}`: `type` (`memoryTagged` | `transferRequest` | `transferAccepted` | `transferRejected` | `communityInvite`), `title`, `body`, `data` (ids), `createdAt`, `readAt` (null). Owner reads and may only set `readAt`. Skipped when the matching pref is false.
- `users/{uid}/blocks/{otherUid}`: `{ createdAt }` owner-only.
- `communities/{id}`: `name`, `description`, `type` (`geographic` | `thematic` | `timeBased` | `institution`), `ownerId`, `placeId` (geographic), `institutionId` (institution), `memberCount`, `createdAt`, `updatedAt`. `members/{uid}`: `role` (`owner` | `guardian` | `member`), `joinedAt`. Clients read only.
- Auto communities (server, in `onMemoryWritten`): geographic `geo-<placeId>` named `<place name> Circle` when a place reaches 5 public memories (owner = first custodian); time-based `time-<year>` `<year> Memories` and `era-<decade>s` `<decade>s Era` from the memory's `createdAt` year; the author is auto-joined to the year community.
- `transfers/{id}`: `placeId`, `fromUserId`, `toUserId`, `status` (`pending` | `accepted` | `rejected` | `revoked` | `expired`), `createdAt`, `respondedAt`, `revokeUntil` (= createdAt + 7 d). Revoke allowed by sender until `revokeUntil`; revoking an accepted transfer removes the recipient from `custodianIds`. Pending transfers older than 7 days become `expired` (daily job). One pending transfer per (place, recipient). Custodians are additive (sender stays).
- `institutions/{id}`: `name`, `allowedEmailDomains[]`, `subZones[] {id, name, latitude, longitude, radiusMeters}`, `communityId`. Admin ids live in the private subcollection `institutions/{id}/admins/{uid}` (`{ userId, since }`), not on the institution doc. Created by staff; admin claim requires verified email in an allowed domain (exact match). Sub-zone radius default 60 m.
- `reports/{id}`: `memoryId`, `reporterId`, `reason`, `note`, `createdAt`. `memories.moderation`: `null` | `'hidden'`.

Copy (exact):
- Profile name: label `Display name`, button `Save name`, error `Use 2 to 40 characters.`
- Search: placeholder `Search people`, empty `No people found.`, min-length hint `Type at least 2 letters.`
- Privacy picker segments: `Public | Private | Time release | Tagged | Community`; tagged empty `Add at least one tagged user.`, tag cap (20) `You can tag up to 20 people.`; community picker label `Choose a community` (lists my communities), empty `Join a community first.`
- Inbox: header button accessibilityLabel `Notifications` with unread badge; title `Notifications`; empty `You're all caught up.`; notification titles `Tagged in a memory`, `Custodianship request`, `Custodianship accepted`, `Custodianship declined`, `Community invitation`; bodies `{name} tagged you in a memory.`, `{name} wants you to become a custodian of {place}.`, `{name} accepted custodianship of {place}.`, `{name} declined custodianship of {place}.`, `{name} invited you to join {community}.`
- Notification settings (profile): section `Notifications`, toggles `Custodianship requests`, `Tags`, `Community invitations`.
- Communities: tab/title `Communities`, segments `Mine | Discover`, create button `Create community`, fields `Name` / `Description`, errors `Name is required` / `Description is required`, buttons `Create`, `Join`, `Leave`, `Invite`, member count `1 member` / `{n} members`, feed empty `No memories shared with this community yet.`, leave confirm `Leave {name}?` / `You can join again any time.` / `Cancel` / `Leave`, owner cannot leave: `Owners can't leave their community.`
- Transfers: place action `Transfer custodianship` (custodians only), sheet title `Choose the new custodian`, button `Send request`, sent toast `Request sent.`, duplicate `A request to this person is already pending.`, inbox actions `Accept` / `Decline`, profile section `Places you look after`, history `Transfer history`, revoke button `Revoke` (until revokeUntil), revoked toast `Transfer revoked.`
- Institutions: title `Institutions`, staff create `Register institution`, admin claim button `Verify as admin`, unverified email `Verify your email address first.` with action `Send verification email` and `Verification email sent to {email}.`, domain mismatch `Your email domain isn't approved for this institution.`, success `You're now an admin of {name}.`, sub-zone `Add sub-zone here`, field `Name`, success `Sub-zone added.`
- Safety: memory action `Report`, sheet title `Why are you reporting this?`, reasons `Spam`, `Harassment or bullying`, `Hate speech`, `Sexual content`, `Violence or threats`, `Something else`, note placeholder `Add details (optional)`, submit `Send report`, thanks `Thanks — we'll review it.`, duplicate `You already reported this.`, rate `You've sent a lot of reports today. Try again tomorrow.`; author action `Block {name}` on memory detail (non-author), confirm `Block {name}?` / `You won't see their memories, and they can't tag, invite or transfer to you.` / `Cancel` / `Block`, profile `Blocked people` list with `Unblock`; hidden badge (author) `Hidden after reports`; profanity warning `This memory may contain offensive language. Save anyway?` buttons `Edit` / `Save anyway`; registration checkbox `I agree to the Terms of Service and Community Guidelines.` error `Please accept the Terms of Service and Community Guidelines.`; profile `Help & support`, `Terms of Service`, `Community Guidelines`.
- Callable errors map to generic copy `Something went wrong. Please try again.` unless listed; offline → `Could not reach the server. Check your connection and try again.`

## Plan 4 decisions (2026-10-19) — development build, push, AR
See ADR-0009 (EAS development build + Expo push) and ADR-0010 (AR with ViroReact + radar fallback).
- Identifiers: Android `com.phantom.echoes`, iOS `com.mrnk2107.echoes` (match the registered Firebase apps). EAS project id from `EXPO_PUBLIC_EAS_PROJECT_ID`.
- `users/{uid}/pushTokens/{tokenId}`: `{ token, platform ('ios'|'android'), createdAt, lastSeenAt }` (ISO), owner-only; `tokenId` = hex SHA-256 of the token (first 32 chars). Removed on sign-out; deleted with the account.
- Push copy (Profile → Notifications): button `Turn on push notifications`; on `Push notifications are on`; denied `Push notifications are blocked in system settings.` with `Open settings`; unavailable (Expo Go / simulator) `Push notifications need the ECHOES app build.`
- AR: map button text `AR` (accessibilityLabel `Explore in AR`), route `/ar`, radius 1000 m, up to 5 places and 8 orbs per place; toggle `Radar view` / `Camera view`; empty `No memory places within 1 km.`; camera denied `Camera access is needed for AR. Showing radar instead.`; unsupported `AR isn't available on this device. Showing radar instead.`; heading unavailable `Compass unavailable — the radar won't rotate.`; orb tap → `/memory/{id}`; aura tap → `/place/{id}`.

## Plan 5 decisions (2026-10-19) — launch readiness
See ADR-0011 (crash and error reporting) and ADR-0012 (E2E with Maestro). Every item in `docs/superpowers/plan5-backlog.md` is either built here or listed under "Deferred" with its reason.

Safety and moderation:
- **Verified reporters hide.** Report docs gain `reporterVerified` (the caller's ID token `email_verified`). A memory is auto-hidden when **3 distinct verified** reporters have reported it. Unverified reports are stored for staff review but never count.
- **Reporting names.** A new callable `reportContent({ targetType: 'community' | 'profile', targetId, reason, note })` writes `reports/{targetType}_{targetId}_{uid}` = `{ targetType, targetId, reporterId, reporterVerified, reason, note, createdAt }`. It never auto-hides (staff act). Same reasons, the same 20/day budget as `reportMemory` (shared action `reportMemory`).
- **Notifications carry `actorId`** (server-written; `null` for system). Account deletion deletes every notification whose `actorId` is the deleted user, so their name leaves other inboxes. Older docs without `actorId` age out through the 90-day TTL.
- **Community invites** use the id `communityInvite_{communityId}_{to}_{yyyymmdd}` (UTC day): a re-invite on a later day notifies again; same-day repeats still collapse.
- **Released time-release tags notify.** A scheduled function `notifyReleasedTags` (every 60 min) finds `timeRelease` memories whose `releaseDate` fell in the last 2 h and sends the usual `memoryTagged` notifications (deterministic ids make overlapping windows safe).
- **Own-read in the server visibility mirror.** `functions/lib/visibility.js` gains `canReadMemory` = author OR `isVisibleMemory`, matching the rules.

Privacy and scale:
- `publicProfiles`: single-doc `get` stays open to signed-in users; `list` requires `request.query.limit <= 30` (the `in`-chunk size). Clients always pass a limit.
- Institution admins move to `institutions/{id}/admins/{uid}` = `{ userId, since }`, readable only by that user. `adminUserIds` is removed from the institution doc (backfill migrates it).
- **Sharded member counts** for auto communities `time-*` and `era-*`: increments go to `communities/{id}/counterShards/{0..9}` (`{ count, updatedAt }`). The shard docs are only change markers: a scheduled `rollupMemberCounts` (every 10 min, 60 minute look-back) finds communities whose shards changed and sets `memberCount` to the `count()` aggregate of the `members` subcollection, which stays the source of truth. Other communities keep direct increments. Counts on sharded communities may lag by up to 10 minutes.
- Functions run with `setGlobalOptions({ maxInstances: 50 })` to bound cost under abuse.
- **Production rules** are built with `node scripts/build-rules.js --prod`, which implies `--require-bucket` and drops the loopback emulator hosts. `deploy:rules` uses it.
- **Listener budgets** (repository-level subscriptions while a screen is mounted, memory backend): Map ≤ 4, Place ≤ 4, Community ≤ 4, AR ≤ 7. Each `subscribeVisibleForPlace` fans out to about 4 Firestore listeners.
- **Bundle budget:** each exported Hermes bundle (android, ios) ≤ **7 864 320 bytes** (7.5 MiB; amended 2026-10-19 after the first measurement of 7.34 MB). Device budgets stay as in release-readiness: cold start < 3 s, memory load < 2 s, location update < 1 s on a mid-range phone.

Push:
- **Lock-screen text never contains user-generated strings.** Push bodies are generic per type; the inbox keeps the full body:
  `memoryTagged` `Someone tagged you in a memory.`; `transferRequest` `You have a new custodianship request.`; `transferAccepted` `Your custodianship request was accepted.`; `transferRejected` `Your custodianship request was declined.`; `communityInvite` `You have a new community invitation.` Titles are unchanged.
- **Receipts.** Each ok ticket is stored at `pushReceipts/{ticketId}` = `{ uid, tokenId, createdAt, expireAt (+1 day) }` (server-only). `checkPushReceipts` (every 30 min) fetches receipts older than 15 min in chunks of 300 (≤ 1000 per run), deletes the token on `DeviceNotRegistered`, then deletes the receipt doc.
- **Client registration** re-runs on foreground at most once per **6 h** per user unless permission changed. A registration that failed offline retries on the next offline → online transition.

Client polish and accessibility:
- `<Notice>` (`src/ui/Notice.tsx`) is the only way to show transient status text: polite Android live region, plus `AccessibilityInfo.announceForAccessibility` on iOS when the message changes.
- `BlocksProvider` is mounted once in `app/(app)/_layout.tsx`; `useBlocksState()` reads it.
- Safe areas: `SafeAreaProvider` at the root; the map top row, the AR back button and full-screen sheets respect insets.
- Map top row: when `width / fontScale < 360` the `Communities` button becomes icon-only (accessibilityLabel `Communities`) and the row wraps.
- Aura history chart: 16:9 aspect from its width; axis text uses `textSecondary`; lines are at least 3:1 against `surface`.
- Inbox hides items whose `actorId` is blocked.
- Institution screens force-refresh the ID token at most once per 60 s.
- Radar: ring labels are hidden when the radar is under 280 px; orbs closer than 12 px are nudged apart.

Copy (exact):
- Report entry points: community screen action `Report community`; memory detail (non-author) `Report {name}`. Sheet title `Why are you reporting this?` (unchanged); duplicate `You already reported this.`
- Membership load error: `Couldn't check your membership.` with `Retry` (no `Join` while unknown).
- Registration repair (Auth account without a `users` doc): title `Finish setting up`, field `Name`, the existing terms checkbox and its error, button `Continue`.

Crash reporting (ADR-0011): `@sentry/react-native` is on only when `EXPO_PUBLIC_SENTRY_DSN` is set and the app is not in Expo Go. No PII: no user id, no email, `sendDefaultPii: false`, no session replay. Functions rely on Cloud Error Reporting and Cloud Monitoring alerts.

E2E (ADR-0012): Maestro flows in `mobile/.maestro/`, run by the owner against the `e2e` EAS profile (memory backend). In CI a Jest test parses each flow and checks every text selector still exists in the source.

Store and operations:
- App config gains the `expo-audio` plugin (microphone string `ECHOES records voice notes for your memories.`), `android.config.googleMaps.apiKey` from `GOOGLE_MAPS_ANDROID_API_KEY`, `ios.config.usesNonExemptEncryption: false`, and an iOS privacy manifest (`NSPrivacyAccessedAPICategoryUserDefaults` reason `CA92.1`, `NSPrivacyAccessedAPICategoryFileTimestamp` reason `C617.1`, tracking false).
- Store listing, Google Play Data safety and Apple privacy labels live in `docs/store/`. The ops runbook lives in `docs/ops/runbook.md`.
- Legacy data is fixed by one backfill tool (`functions/tools/backfill.js`, dry-run by default).
- **The Flutter client is deleted last**, along with the legacy `dispatchNotificationRequest` function and the Flutter CI workflow. `fixtures/domain/*.json` stay and become the oracle; the Dart exporters remain in git history.

Deferred to after launch, with reasons:
- **Unregister on auth-state null without sign-out:** once auth is gone the client cannot delete its token doc. Three things already cover it: explicit sign-out unregisters, account deletion deletes the subcollection, and `onPushTokenCreated` moves a reused token to the next user.
- **Viro plugin and API verification:** blocked until `@reactvision/react-viro` installs on SDK 58. The release gate keeps camera AR off.
- **Firebase App Check:** needs the native Firebase SDK, which conflicts with ADR-0002. Callables are rate-limited and rules require auth.
- **EAS Update (OTA):** not needed for v1.

## Roadmap
| Plan | Scope | Runs in |
|---|---|---|
| 1 | Scaffold, golden fixtures, domain port, data layer (memory + Firestore), backend modes + seed, `onMemoryWritten`, auth, map + place detail, add memory (text/photo/privacy) | Expo Go |
| 2 | Memory detail/edit/soft-delete/30-day restore, voice notes, offline upload queue, profile/settings, account deletion | Expo Go |
| 3 | Public profiles + search, tagged/community privacy, server-authoritative communities, custodianship transfers, institutions, in-app notification inbox, safety (report/block/hide/terms), aura history chart | Expo Go |
| 4 | EAS development build; push notifications (Expo push service) from the inbox; AR (ViroReact) + 2D fallback | dev build |
| 5 | Launch readiness: EAS production builds (Android + iOS), Maestro E2E, crash/error reporting, performance budgets, accessibility pass, store listings + privacy labels, ops runbook, delete Flutter client | EAS |
