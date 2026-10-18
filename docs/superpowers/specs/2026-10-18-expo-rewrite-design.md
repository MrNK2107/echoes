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

## Roadmap
| Plan | Scope | Runs in |
|---|---|---|
| 1 | Scaffold, golden fixtures, domain port, data layer (memory + Firestore), backend modes + seed, `onMemoryWritten`, auth, map + place detail, add memory (text/photo/privacy) | Expo Go |
| 2 | Memory detail/edit/soft-delete/30-day restore, voice notes, offline upload queue, profile/settings, account deletion | Expo Go |
| 3 | Communities (geographic + era), institutions, custodianship transfer, user search/tagging, notifications | dev build for push |
| 4 | AR (ViroReact) + 2D fallback, aura history chart | dev build |
| 5 | EAS builds (Android + iOS), Maestro E2E, CI, delete Flutter client | EAS |
