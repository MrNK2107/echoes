# ECHOES Complete Implementation Design

## July 31, 2026 Production-v1 Decision Addendum

### Confirmed outcome

- Ship the full current specification for Android API 24+ and iOS 15+, targeting a regional launch of roughly 50,000 first-year users.
- Require users to be at least 13; parental-consent flows and under-13 accounts are outside v1.
- Preserve Firebase, clean-architecture repository boundaries, on-device sentiment, foreground-only location, and the 2D fallback for non-AR devices.
- Treat Android device validation as executable in the current environment and iOS build/device validation as a mandatory macOS release gate.

### Decision log

| Decision | Alternatives | Rationale |
|---|---|---|
| Extend existing adapters | Rewrite feature modules | Most product flows are tested and working; adapters close production gaps with lower regression risk. |
| Use native ARCore/ARKit platform views | Keep the canvas simulation; replace both plugins | Meets the specification while retaining the canvas as a safe unsupported-platform fallback. |
| Use `record` + `just_audio` | Platform channels; omit voice notes | Maintained cross-platform packages provide the required 60-second capture and playback flow. |
| Trigger cleanup from Auth deletion | Client-only cascading deletes | A server-side trigger is authoritative and also covers administrative account deletion. |
| Restrict Firestore list rules to visible documents | Trust client filtering | Client filtering is not a security boundary. |
| Require external release secrets | Commit keys or retain debug signing | Credentials stay outside source control and release builds fail closed. |

**Date:** 2026-05-27
**Status:** Approved
**Scope:** Complete all remaining work to make ECHOES production-ready with zero mock/placeholder implementations

---

## Overview

ECHOES is a Flutter/Firebase AR-enabled mobile app where memories attach to places. The codebase is ~87% complete. This design covers the remaining ~13%: replacing all in-memory stubs with real implementations, building out stub features, implementing native AR, adding an embedded map, and validating on real hardware.

## Approach: Risk-First

Phases ordered by risk and dependency. AR first (biggest unknown), then map, then infrastructure swaps, then stub features, then validation.

---

## Phase 1: Native AR (ARCore/ARKit)

**Goal:** Replace the 2D canvas AR simulation with real camera-passthrough AR.

### Current State
- `ArSessionService` interface exists but only `LocalArSessionService` (boolean toggle) is implemented
- `ArSceneMapper` converts GPS coordinates to scene-space (reusable)
- `ArPlaceholderScreen` renders a 2D canvas simulation with hit-testing and animations
- `arcore_flutter_plus` (1.0.2) and `arkit_plugin` (1.3.0) are declared in pubspec but unused
- Domain layer (availability, permission, session interfaces) is solid

### Changes

1. **Create `ArCoreSessionService`** (Android)
   - Implement `ArSessionService` interface using `arcore_flutter_plus`
   - Camera passthrough with AR scene overlay
   - Place 3D aura zones (translucent spheres) at GPS-projected world positions
   - Place memory orbs as floating markers around each zone
   - Reuse `ArSceneMapper` for coordinate conversion
   - File: `lib/features/ar/data/arcore_session_service.dart`

2. **Create `ArKitSessionService`** (iOS)
   - Implement `ArSessionService` interface using `arkit_plugin`
   - Same 3D rendering as Android
   - File: `lib/features/ar/data/arkit_session_service.dart`

3. **Update `app.dart` DI wiring**
   - Replace `LocalArSessionService()` with platform check:
     ```dart
     Platform.isAndroid ? ArCoreSessionService() :
     Platform.isIOS ? ArKitSessionService() :
     LocalArSessionService()
     ```
   - `LocalArSessionService` retained as fallback for non-AR devices

4. **Rename and update screen**
   - Rename `ArPlaceholderScreen` → `ArScreen`
   - Replace `CustomPaint` with `ARKitSceneView` / `ArCoreView`
   - Keep existing permission flow, bottom sheet interactions, and status pill
   - Keep 2D canvas fallback for non-AR devices (detected by `ArAvailabilityService`)

5. **Update tests**
   - Update `ar_placeholder_screen_test.dart` → `ar_screen_test.dart`
   - Keep `ArCubit` tests unchanged (logic is the same)
   - Add integration test for AR session lifecycle

### Risks
- `arcore_flutter_plus` and `arkit_plugin` may have Flutter SDK compatibility issues — verify immediately
- 3D rendering performance on mid-range Android devices — profile early

---

## Phase 2: Embedded Map

**Goal:** Replace the list-based map view with a real Google Maps widget showing aura-colored markers.

### Current State
- `MapCubit` handles location permission and nearby place fetching (working)
- `MapPlaceholderScreen` shows a list of places with aura colors (no map widget)
- `AuraMarkerHue` maps aura colors to `BitmapDescriptor.hue*` values
- `google_maps_flutter` is imported but only used for hue constants

### Changes

1. **Replace list UI with `GoogleMap` widget**
   - Embed `GoogleMap` with user location marker and aura-colored place markers
   - Marker tap → opens existing `PlaceDetailSheet`
   - Keep a scrollable place list below/alongside the map as a companion view
   - File: `lib/features/map/presentation/map_screen.dart`

2. **No domain/data layer changes**
   - `MapCubit`, `LocationService`, `PlaceRepository` already provide everything
   - This is purely a presentation-layer change

3. **Rename** `MapPlaceholderScreen` → `MapScreen`, update references in `EchoesHomeShell`

4. **Update tests**
   - Rename `map_placeholder_screen_test.dart` → `map_screen_test.dart`

### Risks
- `google_maps_flutter` initialization can be slow on some Android devices — show loading state

---

## Phase 3: Firebase Swaps + Persistence

**Goal:** Replace all remaining in-memory services with persistent implementations. Fix hardcoded values.

### Current State
- `useFirebase` flag toggles 13 services between Firebase and Local implementations
- `PendingMemoryUploadQueue` is always `LocalPendingMemoryUploadQueue` (in-memory, lost on restart)
- Notification settings are not persisted (reset on screen rebuild)
- Profile places count is hardcoded to `'0'`
- Edit memory strips tagged/timeRelease/community privacy options

### Changes

**A. Persistent upload queue:**

1. **Create `FirestorePendingMemoryUploadQueue`**
   - Persists pending uploads to `pendingUploads/{userId}` subcollection
   - Survives app kill
   - Implements existing `PendingMemoryUploadQueue` interface
   - File: `lib/features/memories/data/firestore_pending_memory_upload_queue.dart`

2. **Wire in `app.dart`**
   - Replace `LocalPendingMemoryUploadQueue()` with `useFirebase` toggle

**B. Persist notification settings:**

3. **Extend `AppUser` entity**
   - Add fields: `transferAlerts`, `tagAlerts`, `communityAlerts` (all `bool`, default `true`)
   - File: `lib/features/users/domain/app_user.dart`

4. **Extend `AppUserDto`**
   - Add serialization for new fields
   - File: `lib/features/users/data/app_user_dto.dart`

5. **Add `updateNotificationPreferences` to `AppUserRepository`**
   - New method on the interface
   - Implement in `FirestoreAppUserRepository` and `LocalAppUserRepository`

6. **Update `NotificationSettings` widget**
   - Persist toggles via `AppUserRepository.updateNotificationPreferences()`
   - Load initial values from `AppUser` stream
   - File: `lib/features/profile/presentation/notification_settings.dart`

**C. Fix hardcoded values:**

7. **Profile places count**
   - Add `watchPlacesByCustodian(userId)` to `PlaceRepository` interface
   - Implement in `FirestorePlaceRepository` (query where `custodianIds` array-contains userId)
   - Implement in `LocalPlaceRepository`
   - Wire into `ProfilePlaceholderScreen` to replace hardcoded `'0'`

8. **Edit memory privacy**
   - Update `EditMemorySheet` to offer all 5 privacy options (matching `AddMemoryPlaceholderScreen`)
   - Preserve existing `taggedUserIds`, `releaseDate`, `communityId` values on load
   - File: `lib/features/memories/presentation/edit_memory_sheet.dart`

**D. New Firestore security rules:**

9. Add rules for `pendingUploads` collection (owner read/write only)

### Risks
- Firestore pending upload queue needs careful concurrent write handling
- Adding fields to `AppUser` requires migration for existing users (default values in DTO)

---

## Phase 4: Stub Features

**Goal:** Implement all stubbed/disabled features. Each is independent.

### A. Institutions (domain-only → full stack)

1. **Define `InstitutionRepository` interface**
   - Methods: `create`, `getById`, `watchByMember(userId)`, `addSubZone`, `removeSubZone`
   - File: `lib/features/institutions/domain/institution_repository.dart`

2. **Create `FirestoreInstitutionRepository`**
   - Collections: `institutions/{id}`, `institutions/{id}/subZones/{id}`
   - File: `lib/features/institutions/data/firestore_institution_repository.dart`

3. **Create `LocalInstitutionRepository`**
   - In-memory implementation for testing
   - File: `lib/features/institutions/data/local_institution_repository.dart`

4. **Create `InstitutionCubit` + `InstitutionState`**
   - Load institutions, manage admin actions
   - File: `lib/features/institutions/presentation/institution_cubit.dart`

5. **Build screens**
   - `InstitutionScreen` — list of institution zones user belongs to
   - `InstitutionDetailScreen` — sub-zones, admin tools
   - `InstitutionAdminScreen` — manage sub-zones, verify members

6. **Wire into app**
   - Add to `app.dart` DI tree behind `useFirebase` flag
   - Access via Profile screen or Communities sub-navigation

7. **Add Firestore rules** for `institutions` collection

### B. Guardian Reassignment

8. **Define `GuardianReassignmentRequest` entity**
   - Fields: `id`, `placeId`, `nomineeId`, `nominatorId`, `reason`, `status` (pending/approved/rejected), `createdAt`
   - File: `lib/features/places/domain/guardian_reassignment_request.dart`

9. **Define `GuardianReassignmentRepository` interface**
   - File: `lib/features/places/domain/guardian_reassignment_repository.dart`

10. **Create `FirestoreGuardianReassignmentRepository`**
    - Collection: `reassignmentRequests/{id}`
    - File: `lib/features/places/data/firestore_guardian_reassignment_repository.dart`

11. **Replace disabled button in `GuardianReassignmentPlaceholder`**
    - Working form: nominate custodian, reason, submit
    - Show pending requests in `PlaceDetailSheet`
    - Rename to `GuardianReassignmentButton`

12. **Integrate notifications** — notify current custodians on new request

13. **Add Firestore rules** for `reassignmentRequests` collection

### C. Delete Account

14. **Create `FirebaseAccountDeletionService`**
    - Soft-delete user's memories (set `deletedAt`)
    - Remove user from place `custodianIds` arrays
    - Delete user profile document
    - Call `FirebaseAuth.currentUser.delete()`
    - File: `lib/features/auth/data/firebase_account_deletion_service.dart`

15. **Create `LocalAccountDeletionService`** for testing

16. **Wire the "Delete account" button in `ProfilePlaceholderScreen`**
    - Confirmation dialog → call service → sign out

### D. Memory Restore (30-day window)

17. **Add `restoreMemory(id)` to `MemoryRepository` interface**
    - Implement in `FirestoreMemoryRepository` (set `deletedAt = null`)
    - Implement in `LocalMemoryRepository`

18. **Add `watchRecentlyDeleted(userId)` query**
    - Memories where `deletedAt != null` and `deletedAt` within 30 days

19. **Replace disabled button in `MemoryDetailSheet`**
    - Show "Restore" action for soft-deleted memories within 30-day window

20. **Add "Recently Deleted" section in Profile**
    - List of recoverable memories with restore action

### E. Community Feed

21. **Wire `watchByCommunity(communityId)` into `CommunityDetailScreen`**
    - `FirestoreMemoryRepository` already has this method
    - Replace placeholder text with `StreamBuilder<List<Memory>>`
    - Reuse existing `MemoryCard` widget
    - File: `lib/features/communities/presentation/community_detail_screen.dart`

### F. Notification Inbox

22. **Define `NotificationInboxItem` entity**
    - Fields: `id`, `type` (transfer/tag/community), `title`, `body`, `targetId`, `read`, `createdAt`
    - File: `lib/features/notifications/domain/notification_inbox_item.dart`

23. **Define `NotificationInboxRepository` interface**
    - Methods: `watchUnread(userId)`, `watchAll(userId)`, `markRead(notificationId)`
    - File: `lib/features/notifications/domain/notification_inbox_repository.dart`

24. **Create `FirestoreNotificationInboxRepository`**
    - Collection: `notifications/{userId}/items/{id}`
    - File: `lib/features/notifications/data/firestore_notification_inbox_repository.dart`

25. **Extend Cloud Function `dispatchNotificationRequest`**
    - Also write to `notifications/{recipientUserId}/items/{id}` when dispatching FCM

26. **Build `NotificationInboxScreen`**
    - List of notifications with read/unread state
    - Tap → navigate to relevant screen (place, memory, community)
    - File: `lib/features/notifications/presentation/notification_inbox_screen.dart`

27. **Add notification badge**
    - Bell icon in app bar or badge on home shell bottom nav
    - `NotificationBadgeCubit` watching unread count

28. **Add Firestore rules** for `notifications/{userId}/items` subcollection

---

## Phase 5: Polish & Validation

**Goal:** Ensure everything works on real hardware and meets SPEC.md performance targets.

### A. Integration Tests

1. Implement 10 end-to-end flows using Firebase emulator:
   - Sign up, Sign in, Add memory, View place, View memory detail, Edit memory, Soft delete memory, Join community, Create community memory, Transfer custodianship
2. Wire `integration_test/` directory with emulator-backed tests
3. Add integration test step to CI (`flutter.yml`)

### B. Device Testing

4. Android emulator — smoke test all flows
5. Android physical device — camera, gallery, location, notification permissions
6. Target mid-range Android (15-20k INR) — performance benchmarking
7. iOS simulator — smoke test all flows
8. iOS physical device — permissions and AR
9. ARCore device — full AR session with camera passthrough, 3D rendering
10. Non-AR device — confirm 2D canvas fallback

### C. Performance Benchmarks (SPEC.md targets)

11. App launch < 3s — profile cold start
12. Memory/place load < 2s — measure Firestore query-to-render
13. Location update < 1s — measure `Geolocator.getCurrentPosition()` latency
14. AR frame rate ≥ 30 FPS — measure with `SchedulerBinding.instance.addTimingsCallback`
15. Optimize if targets missed: lazy-load queries, reduce rebuilds, compress image pipeline, optimize AR scene graph

### D. Remaining Polish

16. **Splash screen** — add logo animation (fade-in or pulse) instead of static text
17. **Rename placeholder screens** — remove "Placeholder" suffix from all file names, class names, route references
18. **CI updates** — add integration test step, add performance regression check
19. **Firestore rules** — add rules for all new collections from Phase 3-4
20. **Cloud Functions** — extend for notification inbox writes, guardian reassignment notifications

### Exit Criteria

- All SPEC.md performance targets met on target hardware
- All 10 integration tests passing
- All 12 beta smoke checklist items passing
- Zero `Local*` services used in production path (only as test doubles)
- All disabled buttons replaced with working implementations
- All hardcoded values replaced with real queries

---

## Summary

| Phase | Focus | Key Deliverables |
|---|---|---|
| 1 | Native AR | ArCoreSessionService, ArKitSessionService, 3D rendering, ArScreen |
| 2 | Embedded Map | GoogleMap widget with aura markers, MapScreen |
| 3 | Firebase Swaps | Persistent upload queue, notification settings, fix hardcoded values |
| 4 | Stub Features | Institutions, guardian reassignment, delete account, memory restore, community feed, notification inbox |
| 5 | Polish & Validation | Integration tests, device testing, performance benchmarks, rename placeholders |
