# ADR-0004: One composition root with three backend modes

**Status:** Accepted
**Date:** 2026-10-18

## Context
The Flutter app used one boolean (`useFirebase`) to switch data *and* device
services together, built every service inside `EchoesApp.build()` (re-created on
rebuild), and its local mode started empty. Result: the app could not be explored
without a configured Firebase project.

## Decision
- Repository interfaces in `mobile/src/data/*/types.ts`, with an in-memory and a
  Firestore implementation each.
- `createServices(config): Services` builds everything once; `ServicesProvider`
  exposes it via React context; tests pass their own `Services`.
- `EXPO_PUBLIC_BACKEND` selects `memory` (default; seeded demo data, no network),
  `emulator` (Firebase emulators at `EXPO_PUBLIC_EMULATOR_HOST`, default
  `127.0.0.1`), or `firebase` (real project from `EXPO_PUBLIC_FIREBASE_*`).
- Device services (location, image picker) are separate interfaces with Expo and
  fake implementations, chosen independently of the backend.
- State: screen-level React hooks subscribing to repository streams
  (`subscribe(listener) => unsubscribe`). No Redux/Zustand/TanStack Query until a
  concrete need appears.

## Consequences
- Easier: `npx expo start` → scan → a populated app; deterministic tests.
- Harder: three backends to keep behaviourally equal — mitigated by one shared
  contract test suite run against memory (Jest) and Firestore (emulator).
