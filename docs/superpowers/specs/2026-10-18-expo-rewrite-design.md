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

## Domain rules (oracle = Dart code + `fixtures/domain/*.json`)
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
- `institutions/{id}`: `name`, `allowedEmailDomains[]`, `adminUserIds[]`, `subZones[] {id, name, latitude, longitude, radiusMeters}`, `communityId`. Created by staff; admin claim requires verified email in an allowed domain (exact match). Sub-zone radius default 60 m.
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
- Safety: memory action `Report`, sheet title `Why are you reporting this?`, reasons `Spam`, `Harassment or bullying`, `Hate speech`, `Sexual content`, `Violence or threats`, `Something else`, note placeholder `Add details (optional)`, submit `Send report`, thanks `Thanks — we'll review it.`, duplicate `You already reported this memory.`, rate `You've sent a lot of reports today. Try again tomorrow.`; author action `Block {name}` on memory detail (non-author), confirm `Block {name}?` / `You won't see their memories, and they can't tag, invite or transfer to you.` / `Cancel` / `Block`, profile `Blocked people` list with `Unblock`; hidden badge (author) `Hidden after reports`; profanity warning `This memory may contain offensive language. Save anyway?` buttons `Edit` / `Save anyway`; registration checkbox `I agree to the Terms of Service and Community Guidelines.` error `Please accept the Terms of Service and Community Guidelines.`; profile `Help & support`, `Terms of Service`, `Community Guidelines`.
- Callable errors map to generic copy `Something went wrong. Please try again.` unless listed; offline → `Could not reach the server. Check your connection and try again.`

## Roadmap
| Plan | Scope | Runs in |
|---|---|---|
| 1 | Scaffold, golden fixtures, domain port, data layer (memory + Firestore), backend modes + seed, `onMemoryWritten`, auth, map + place detail, add memory (text/photo/privacy) | Expo Go |
| 2 | Memory detail/edit/soft-delete/30-day restore, voice notes, offline upload queue, profile/settings, account deletion | Expo Go |
| 3 | Public profiles + search, tagged/community privacy, server-authoritative communities, custodianship transfers, institutions, in-app notification inbox, safety (report/block/hide/terms), aura history chart | Expo Go |
| 4 | EAS development build; push notifications (Expo push service) from the inbox; AR (ViroReact) + 2D fallback | dev build |
| 5 | Launch readiness: EAS production builds (Android + iOS), Maestro E2E, crash/error reporting, performance budgets, accessibility pass, store listings + privacy labels, ops runbook, delete Flutter client | EAS |
