# ECHOES — Ground Truth Status

**Updated:** July 31, 2026  
**Target:** Production-ready v1 for Android and iOS, age 13+

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
