# ADR-0006: Persisted outbox for memory drafts

**Status:** Accepted
**Date:** 2026-10-19

## Context
The Firebase JS SDK on React Native has no persistent Firestore cache (ADR-0002), so a
write made offline is lost if the app is closed, and `setDoc` never resolves without a
connection. Plan 1 handled this with a 15 s timeout plus single-flight retry (ruling
R10), which silently ignored edits made after a timeout. The Flutter app's upload queue
was in-memory only and covered images, not audio.

## Decision
Every saved memory becomes a **draft** with ids fixed at submit time:
`memoryId = newId()`, `placeIdIfNew = 'p_' + memoryId`, `createdAt = now`.
Submitting runs the draft online under the 15 s timeout. If it times out or fails with a
network error, the draft (with its photo/voice files copied into the app's document
directory) is written to a **persisted outbox** (AsyncStorage key `outbox:<uid>`) and
the user is told it will upload later. An outbox processor replays drafts on app start,
when connectivity returns, and on manual Retry, with exponential backoff
2, 4, 8, 16, 32, 64 s (cap 64 s; Retry resets it).

Replays are idempotent by construction:
- media uploads overwrite the same Storage path (`memory-images/{uid}/{memoryId}.jpg`, `memory-audio/{uid}/{memoryId}.m4a`);
- the place is created only if `placeIdIfNew` does not already exist and no place lies within 100 m;
- the memory is written with `setDoc` at the fixed `memoryId` with identical data, which `firestore.rules` accepts as an empty-diff author update.

## Options considered
| | Outbox (chosen) | Single-flight retry (Plan 1) | @react-native-firebase persistence |
|---|---|---|---|
| Survives app restart | Yes | No | Yes |
| Works in Expo Go | Yes | Yes | No |
| Duplicate-safe | Yes (fixed ids) | Mostly | Yes |
| Complexity | Medium | Low | Medium + dev build |

## Consequences
- Easier: real offline capture, no duplicate memories, edits are never silently dropped (the form is done once queued).
- Harder: a queued memory is invisible to others until it syncs; the UI must show pending drafts.
- Revisit: when the dev build exists (Plan 4), native Firestore persistence could replace part of this.
