# ADR-0001: Rewrite the mobile client in React Native + Expo

**Status:** Accepted
**Date:** 2026-10-18
**Deciders:** Project owner

## Context
The Flutter client (≈14.4k lines app code, 6.4k lines tests, 182 passing tests) is
code-complete for v1 but painful to exercise day to day. Development happens on a
Windows machine with no Mac and no configured Android emulator; every manual check
needs a native build, iOS builds are impossible locally, and the owner prefers the
React Native + Expo Go workflow (scan a QR code, live reload on a physical phone).
The Firebase backend (Firestore rules, indexes, Storage rules, Cloud Functions,
rules tests) is independent of the client and reusable.

## Decision
Rewrite the client in React Native with Expo SDK 58, TypeScript strict mode and
Expo Router. Keep the Firebase backend and project. Develop in Expo Go for every
feature that does not need custom native code; use an EAS development build only
for AR and push notifications (later plans).

## Options Considered

### Option A: Stay on Flutter, improve the dev loop
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | Days |
| Scalability | Unchanged |
| Team familiarity | Owner finds Flutter painful |

**Pros:** No rewrite; tests and features already exist.
**Cons:** Still needs a native build per device; iOS still blocked without a Mac.

### Option B: React Native + Expo (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | High (full client rewrite) |
| Cost | Weeks |
| Scalability | Same backend |
| Team familiarity | Preferred by owner |

**Pros:** Expo Go loop with no native builds; EAS Build compiles iOS in the cloud;
TypeScript ecosystem; backend reused unchanged.
**Cons:** All screens and client tests rewritten; AR needs a dev build and a
less mature library (ViroReact).

## Trade-off Analysis
The backend (the hard-won security model) survives intact, so the rewrite is
confined to the client. The cost is paid once; the dev-loop and iOS-build
benefits are paid back on every change.

## Consequences
- Easier: running the app on a phone, iOS builds, hiring/tooling.
- Harder: AR (deferred to its own plan with a dev build).
- Revisit: delete the Flutter client once the Expo app reaches parity (final plan).

## Action Items
1. [ ] Plan 1 — foundation + core memory loop (`docs/superpowers/plans/2026-10-18-expo-foundation-core-loop.md`).
2. [ ] Plans 2–5 per the roadmap in the design spec.
