# ECHOES — Ground Truth Status

**Updated:** October 19, 2026  
**Target:** Production-ready v1 for Android and iOS, age 13+

## Expo rewrite — Plan 1

The active client is now the React Native + Expo app in `mobile/` (branch `expo-rewrite`). Plan 1 (foundation and core loop) is verified by the gates below; the Flutter notes further down are historical.

| Command | Result |
| --- | --- |
| `npm --prefix mobile test` | Pass (21 suites, 251 tests) |
| `npm --prefix mobile run typecheck` | Pass |
| `npm --prefix mobile run lint` | Pass |
| `npm test --prefix functions` | Pass (29 tests) |
| `npx firebase emulators:exec --project demo-echoes --only auth,firestore,storage,functions "npm --prefix mobile run test:emulator"` | Pass (19 tests) |
| `npx firebase emulators:exec --only firestore "npm test --prefix rules_test"` | Pass (11 tests) |
| `cd mobile && npx expo export --platform android --output-dir dist && npx expo export --platform ios --output-dir dist-ios` | Pass (both bundles exported) |

### Manual Expo Go checklist

- [ ] `cd mobile && npx expo start`, scan the QR code with Expo Go
- [ ] Sign in with `demo@echoes.app` / `echoes-demo`
- [ ] Map shows 6+ markers
- [ ] Open a place
- [ ] Add a memory
- [ ] The memory appears on the place

### Known follow-ups

- Firebase and emulator modes are not yet smoke-tested on a device.
- Date picker and Google Maps rendering are not verified on a device.

---

## Outcome

The repository-side v1 implementation is complete. The app now has working
Firebase-backed and local-mode flows for authentication, users, memories,
places, maps, native AR scenes, voice notes, communities, institutions,
custodianship, aura history, notifications, offline retry, account deletion,
and 30-day memory restoration.

Production launch still requires the external configuration and physical-device
checks listed in `docs/release-readiness.md`. Those gates require production
credentials, signing identities, a Firebase project, and Apple hardware; they
cannot be completed from this Windows workspace.

## Completed in the July 31 hardening pass

- Replaced the simulated AR presentation with ARCore and ARKit scene views,
  retaining a safe 2D fallback.
- Added 60-second voice-note recording, Firebase Storage upload, and native
  Android/iOS playback.
- Added a real connectivity monitor and automatic pending-upload retry.
- Added Firestore-backed institution zones and administration UI.
- Added Firestore-backed aura history and visualization.
- Completed community feeds, guardian reassignment, account deletion, and
  30-day memory restore flows.
- Added server-side account cleanup for user-owned Firestore and Storage data.
- Tightened Firestore list authorization so broad queries cannot expose private
  memories.
- Migrated memory dates to Firestore timestamps with backward-compatible reads.
- Added Firestore composite indexes and Firebase index configuration.
- Added Android release signing and Maps-key injection requirements.
- Added 13+ registration confirmation and mobile permission descriptions.
- Added a device integration smoke test and Android emulator CI job.

## Verified

| Gate | Result |
| --- | --- |
| `flutter analyze` | Pass — no issues |
| `flutter test` | Pass — 182 tests |
| Functions lint/tests | Pass — 2 tests |
| Firestore emulator rules | Pass — 11 tests |
| Android debug compilation | Pass |
| JSON/YAML parsing | Pass |
| `git diff --check` | Pass |

## External release gates

- Add production Firebase configuration files and deploy rules, indexes,
  Storage rules, and Functions.
- Supply restricted Google Maps keys and Android release-signing secrets.
- Run the Android hardware matrix, including ARCore and performance targets.
- Build, archive, and test iOS on macOS with signing and a physical ARKit device.
- Complete store privacy, age-rating, support, and account-deletion disclosures.

See `docs/release-readiness.md` for the executable checklist.
