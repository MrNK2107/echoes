# ADR-0003: Compute place aura and counts in a Cloud Function

**Status:** Accepted
**Date:** 2026-10-18

## Context
In the Flutter client, adding a memory performs five separate client writes:
create place (if none within 100 m), create memory, re-read the place's memories,
recompute the aura, save the place, write an aura history entry. Problems:
1. `firestore.rules` allows `places/{id}` updates only by custodians, so a user
   adding a memory to someone else's place cannot update its aura or counts — the
   write is denied after the memory is already created.
2. The sequence is not atomic; a crash midway leaves counts and aura stale.
3. The client reads memories it may not be allowed to list.

## Decision
Add a Firestore trigger `onMemoryWritten` (`memories/{memoryId}`, v2
`onDocumentWritten`) that, using the Admin SDK, recomputes for the memory's place:
`aura` (from non-deleted **public** memories), `memoryCount` (non-deleted),
`publicMemoryCount`, `updatedAt`, and appends a `places/{placeId}/auraHistory`
entry. The client only creates the place (when new) and the memory.

The aura algorithm lives in two places — `mobile/src/domain/aura.ts` (for
optimistic UI and seeded data) and `functions/aura.js` — and both are pinned by the
same golden fixture file `fixtures/domain/aura.json` generated from the Dart
implementation. A shared npm workspace was rejected: Firebase deploy uploads only
`functions/`, so local package dependencies need bundling, which is more machinery
than one 60-line function justifies.

## Consequences
- Easier: correct counts for non-custodians; one client write path; rules can stay strict.
- Harder: aura updates are eventually consistent (≈1–2 s); tests need the Functions runtime.
- Revisit: if more domain logic is shared server-side, introduce a bundled shared package.
