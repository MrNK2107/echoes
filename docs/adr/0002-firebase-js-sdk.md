# ADR-0002: Use the Firebase JS SDK, not @react-native-firebase

**Status:** Accepted
**Date:** 2026-10-18

## Context
The client must talk to the existing Firebase project (Auth, Firestore, Storage).
Expo Go cannot load custom native modules, and Expo Go compatibility is the reason
for the rewrite (ADR-0001).

## Decision
Use the modular Firebase JS SDK (`firebase@13`). Persist auth with
`initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`.
All Firebase access sits behind repository interfaces (ADR-0004), so swapping to
`@react-native-firebase` later is a data-layer change only.

## Options Considered
| | JS SDK (chosen) | @react-native-firebase |
|---|---|---|
| Works in Expo Go | Yes | No (dev build required) |
| Offline persistence | Memory cache only on RN | Full native disk cache |
| Crashlytics/Analytics | No | Yes |
| Complexity | Low | Medium |

## Consequences
- Easier: zero-build dev loop; same SDK in Jest emulator tests.
- Harder: no native Firestore disk cache; Crashlytics/Analytics deferred.
- Revisit: when the dev build exists (AR plan), re-evaluate native Firebase for
  offline cache and crash reporting.
