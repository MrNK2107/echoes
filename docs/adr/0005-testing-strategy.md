# ADR-0005: Testing strategy for the Expo client

**Status:** Accepted
**Date:** 2026-10-18

## Decision
| Layer | Tool | Runs where |
|---|---|---|
| Domain (pure TS) | Jest; **golden fixtures** exported from the Dart implementation into `fixtures/domain/*.json` | `npm test` |
| Repository contracts | One Jest suite per repository, run against the memory impl (`npm test`) and the Firestore impl (`npm run test:emulator` inside `firebase emulators:exec`) | local + CI |
| Hooks/screens | `jest-expo` preset + `@testing-library/react-native` with in-memory services | `npm test` |
| Cloud Functions | `node --test` with pure-function unit tests + emulator trigger test | local + CI |
| Security rules | existing `rules_test` | CI |
| E2E | Maestro flows against an EAS dev build (later plan) | CI |

Golden fixtures make the Dart code the oracle during the port: the TypeScript
sentiment analyzer, geohash, nearby query, aura calculator and privacy check must
reproduce the Dart outputs exactly (numbers compared with `toBeCloseTo(x, 10)`).

All work is test-first (red → green → commit).
