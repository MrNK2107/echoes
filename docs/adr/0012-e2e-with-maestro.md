# ADR-0012: End-to-end tests with Maestro against the demo backend

**Status:** Accepted
**Date:** 2026-10-19

## Context
ADR-0005 planned Maestro flows in CI. The project is developed on Windows, and CI has no device farm or iOS simulator. EAS builds also need the owner's Expo account. Flows must not depend on a live Firebase project, which would leave test data and need real accounts.

## Decision
- **Flows** live in `mobile/.maestro/*.yaml` with `appId: com.phantom.echoes`. They select elements only by visible copy (the app has no `testID`s; copy is single-sourced in `src/ui/copy.ts`).
- **Target:** a new EAS profile `e2e` (internal distribution, Android APK, iOS simulator build) with `EXPO_PUBLIC_BACKEND=memory`. The seeded demo backend gives deterministic data and the demo account `demo@echoes.app` / `echoes-demo`. Location comes from Maestro `setLocation` at a seeded place.
- **CI gate:** `mobile/test/maestroFlows.test.ts` parses every flow (`yaml` devDependency) and checks that:
  - `appId` is correct;
  - every `tapOn`, `assertVisible` and `assertNotVisible` text appears literally in `mobile/src` or `mobile/app`.

  Copy changes that break a flow therefore fail `npm test`. The existing Jest smoke and screen tests remain the behavioural gate.
- **Running the flows** on an emulator or device (`maestro test mobile/.maestro`) is an owner release gate recorded in `docs/release-readiness.md`. It is never reported as passed without a real run.

## Consequences
- **Easier:** flows stay in sync with the copy without a device in CI, and they run against reproducible data.
- **Harder:** Firebase-backed behaviour (rules, functions, push) is covered by the emulator suites, not by E2E. A real device run is still needed before each store release.
