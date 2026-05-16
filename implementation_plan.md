# ECHOES Implementation Plan

## Planning Progress

- [x] Reviewed `SPEC.md`
- [x] Confirmed current repository state
- [x] Identified project as greenfield Flutter implementation
- [x] Drafted implementation plan
- [x] Bootstrap Flutter project
- [x] Begin MVP implementation

## Completion Snapshot

Last updated: 2026-05-16

- Overall checklist completion: 245 / 387 items complete, about 63%.
- Internal Alpha feature scope: mostly implemented in code; device smoke testing and security-rules tests remain.
- Private Beta feature scope: partially implemented; AR rendering, transfer initiation UI, and tagged-user search are in place; rules tests and deeper AR interaction remain.
- Public MVP feature scope: in progress; offline cache, accessibility, performance, notifications, and production hardening remain.

## Current Repository State

The repository now contains the product specification, implementation plan, and a Flutter/Firebase application foundation:

- `SPEC.md`
- `implementation_plan.md`
- Flutter app source in `lib/`
- Platform folders for Android, iOS, web, desktop
- Firebase Auth, Firestore, Storage, Google Maps, and AR dependencies wired behind repository/service abstractions
- Unit and widget tests for the current local MVP and AR lifecycle foundation

Native Firebase config files are present locally but ignored by git for GitHub safety. Production hardening, Firebase Cloud Functions, security-rules tests, notification delivery, offline sync, and full AR rendering remain to be implemented.

## Implementation Strategy

ECHOES should be built in progressive layers. The core product promise is place-based memory preservation with privacy and emotional aura visualization. AR is a signature feature, but it should not be the first technical dependency because the data model, privacy model, place discovery, and memory creation flows need to be reliable before AR rendering is useful.

Recommended delivery order:

1. Build the Flutter/Firebase foundation.
2. Implement authentication and user profiles.
3. Implement map-based place discovery.
4. Implement memory creation and viewing.
5. Implement privacy enforcement.
6. Implement sentiment and 2D aura visualization.
7. Implement AR aura zones and memory orbs.
8. Implement advanced privacy, communities, and legacy transfer.
9. Add offline support, performance hardening, and accessibility polish.

## Technical Foundation

### Target Stack

- [x] Flutter 3.x
- [x] Dart
- [x] Firebase Auth
- [x] Cloud Firestore
- [x] Firebase Storage
- [ ] Firebase Cloud Functions, where server-side validation or denormalized updates are needed
- [x] Google Maps SDK
- [x] ARCore via `arcore_flutter_plus` for Android
- [x] ARKit via `arkit_plugin` for iOS
- [x] On-device sentiment analysis foundation with swappable VADER interface
- [x] BLoC for state management
- [x] Clean Architecture split into data, domain, and presentation layers

### Recommended Project Structure

```text
lib/
  app/
    app.dart
    router.dart
    theme.dart
  core/
    config/
    constants/
    errors/
    location/
    permissions/
    services/
    utils/
  features/
    auth/
      data/
      domain/
      presentation/
    users/
      data/
      domain/
      presentation/
    memories/
      data/
      domain/
      presentation/
    places/
      data/
      domain/
      presentation/
    map/
      data/
      domain/
      presentation/
    aura/
      data/
      domain/
      presentation/
    ar/
      data/
      domain/
      presentation/
    privacy/
      domain/
      presentation/
    communities/
      data/
      domain/
      presentation/
    legacy/
      data/
      domain/
      presentation/
  shared/
    widgets/
    models/
    extensions/
test/
integration_test/
```

### Bootstrap Tasks

- [x] Create Flutter application in the repository.
- [x] Add Android and iOS platform folders.
- [x] Configure Firebase project.
- [x] Add Firebase config files for Android and iOS.
- [x] Add base dependencies.
- [x] Configure linting.
- [x] Configure app flavors or environment files for development and production.
- [x] Add dark theme defaults.
- [x] Add root navigation shell.
- [x] Add basic app startup and error boundary handling.
- [x] Add CI-ready test commands.

## Core Domain Model

### User

- [x] Create `AppUser` domain entity.
- [x] Create user Firestore DTO.
- [x] Create user repository.
- [x] Create user profile creation flow after signup.

Required fields:

```dart
class AppUser {
  final String id;
  final String? displayName;
  final String? email;
  final String? photoUrl;
  final PrivacyType defaultPrivacy;
  final List<String> managedPlaceIds;
  final List<String> communityIds;
  final DateTime createdAt;
  final DateTime updatedAt;
}
```

### Memory

- [x] Create `Memory` domain entity.
- [x] Create memory Firestore DTO.
- [x] Create memory repository.
- [x] Add create, read, update, and soft-delete operations.
- [x] Prevent editing location and timestamp after creation.

Required fields:

```dart
class Memory {
  final String id;
  final String userId;
  final String placeId;
  final String? imageUrl;
  final String? audioUrl;
  final String textContent;
  final double latitude;
  final double longitude;
  final String geohash;
  final SentimentResult sentiment;
  final PrivacyType privacy;
  final List<String> taggedUserIds;
  final String? communityId;
  final DateTime? releaseDate;
  final bool isDeleted;
  final DateTime? deletedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
}
```

### Place

- [x] Create `Place` domain entity.
- [x] Create place Firestore DTO.
- [x] Create place repository.
- [x] Add nearby place lookup.
- [x] Add place creation when first memory is added.
- [x] Add first-memory creator as initial custodian.

Required fields:

```dart
class Place {
  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final String geohash;
  final String? communityId;
  final List<String> custodianIds;
  final AuraZone aura;
  final int memoryCount;
  final int publicMemoryCount;
  final DateTime createdAt;
  final DateTime updatedAt;
}
```

### Aura Zone

- [x] Create `AuraZone` value object.
- [x] Implement sentiment-to-color mapping.
- [x] Implement intensity calculation from memory count.
- [x] Implement recency-weighted aura calculation.

Required fields:

```dart
class AuraZone {
  final SentimentCategory dominantSentiment;
  final double compoundScore;
  final double intensity;
  final int memoryCount;
  final String colorHex;
  final DateTime updatedAt;
}
```

### Community

- [x] Create `Community` domain entity.
- [x] Create membership model.
- [x] Add role model for owner, guardian, member, and visitor.
- [x] Add community repository.

### Legacy Transfer

- [x] Create `LegacyTransfer` domain entity.
- [x] Create transfer repository.
- [x] Add transfer state machine.
- [x] Add transfer history.

## Firestore Collections

- [x] `users/{userId}`
- [x] `places/{placeId}`
- [x] `memories/{memoryId}`
- [x] `communities/{communityId}`
- [x] `communities/{communityId}/members/{userId}`
- [x] `transfers/{transferId}`

## Firebase Security Rules

Privacy is a core product requirement and must be implemented early.

- [x] Authenticated users can read public memories.
- [x] Users can read their own private memories.
- [x] Users can read memories where their ID is present in `taggedUserIds`.
- [x] Users can read community memories only when they are members of that community.
- [x] Time-release memories become public only after `releaseDate`.
- [x] Deleted memories are excluded from normal reads.
- [x] Users can create memories only for themselves.
- [x] Users can edit only allowed mutable fields on their own memories.
- [x] Users cannot edit memory location or original timestamp.
- [x] Users can soft-delete their own memories.
- [x] Place custodians can soft-delete memories attached to their managed places.
- [x] Only custodians can initiate custodianship transfers.
- [x] Only transfer recipients can accept transfers.

## Phase 0: Project Bootstrap

Goal: establish a working Flutter application with Firebase-ready structure.

- [x] Generate Flutter project.
- [ ] Confirm app runs on Android emulator.
- [ ] Confirm app runs on iOS simulator, if available.
- [x] Add package dependencies.
- [x] Configure Firebase.
- [x] Add app theme.
- [x] Add app router.
- [x] Add bottom navigation shell with placeholder tabs:
  - [x] Map
  - [x] AR
  - [x] Add
  - [x] Communities
  - [x] Profile
- [x] Add basic loading, empty, and error UI widgets.
- [x] Add first smoke test.

Deliverable:

- A runnable Flutter app with empty navigable screens and Firebase initialized.

## Phase 1: Authentication and Profile

Goal: users can sign up, sign in, and have a profile document.

- [x] Implement splash/auth gate.
- [x] Implement login screen.
- [x] Implement register screen.
- [x] Implement logout.
- [x] Create user document after signup.
- [x] Load user profile after auth state changes.
- [x] Add profile screen with user information.
- [x] Add default privacy preference.
- [x] Add account deletion placeholder.

Tests:

- [x] Unit test auth repository behavior with mocks.
- [x] Unit test local user profile repository.
- [x] Widget test login validation.
- [x] Widget test register validation.

Deliverable:

- Authenticated users can enter the app and see their profile.

## Phase 2: Location and Map Foundation

Goal: users can see their location and nearby memory places on a map.

- [x] Add foreground location permission flow.
- [x] Add permission denied state.
- [x] Add current location fetch.
- [x] Add Google Map screen.
- [x] Add current location marker.
- [x] Add geohash support.
- [x] Add nearby place query.
- [x] Render place markers.
- [x] Color markers using aura color.
- [x] Add marker tap behavior.
- [x] Open place detail bottom sheet or screen.

Tests:

- [x] Unit test location permission states.
- [x] Unit test nearby query parameter generation.
- [x] Widget test map permission states.

Deliverable:

- Map home displays nearby places and opens place details.

## Phase 3: Memory Creation MVP

Goal: users can create photo and text memories at their current location.

- [x] Build add memory screen.
- [x] Add text input with 1-2000 character validation.
- [x] Add photo capture.
- [x] Add gallery selection.
- [x] Add current GPS capture.
- [x] Add public/private privacy selector.
- [x] Add preview before save.
- [x] Compress image to max 1MB.
- [x] Upload image to Firebase Storage.
- [x] Create memory Firestore document.
- [x] Find nearby place within configured radius.
- [x] Create place if no nearby place exists.
- [x] Attach memory to place.
- [x] Assign first custodian when place is created.
- [x] Update place memory count.

Tests:

- [x] Unit test memory validation.
- [x] Unit test place matching radius.
- [x] Widget test add memory form.
- [ ] Integration test create-memory happy path.

Deliverable:

- Users can add a public or private memory with photo, text, and GPS location.

## Phase 4: Memory Viewing and Management

Goal: users can view, edit, and soft-delete memories.

- [x] Build memory card component.
- [x] Build memory detail screen.
- [x] Show image, text, timestamp, location, and creator visibility.
- [x] Hide creator info when privacy requires it.
- [x] Build place detail memory list.
- [x] Filter visible memories by privacy rules.
- [x] Add profile memory list.
- [x] Add edit memory screen.
- [x] Allow text edits.
- [x] Allow privacy edits.
- [x] Prevent location edits.
- [x] Prevent timestamp edits.
- [x] Add soft delete.
- [x] Add deleted-memory recovery placeholder for future 30-day restore.

Tests:

- [x] Unit test visibility helper.
- [x] Unit test edit constraints.
- [x] Widget test memory detail.
- [ ] Integration test edit memory.
- [ ] Integration test soft delete.

Deliverable:

- Users can browse visible memories and manage their own memories.

## Phase 5: Sentiment and Aura MVP

Goal: places develop a visible emotional aura based on public memories.

- [x] Add on-device sentiment implementation.
- [x] Analyze memory text during creation.
- [x] Store sentiment result on memory.
- [x] Implement aura calculation service.
- [x] Weight memories by recency.
- [x] Calculate dominant sentiment.
- [x] Map dominant sentiment to color.
- [x] Calculate intensity from memory count.
- [x] Persist aura summary on place.
- [x] Show aura color on map markers.
- [x] Show aura preview in place detail.
- [x] Add aura history data model placeholder.

Suggested sentiment thresholds:

- Positive: compound score `>= 0.35`
- Peaceful: compound score `>= 0.1` and `< 0.35`
- Neutral: compound score `> -0.1` and `< 0.1`
- Mixed: broad distribution across positive and negative memories
- Heavy: compound score `<= -0.35`

Aura colors:

- Positive or joyful: `#FFB347`
- Peaceful or calm: `#77DD77` or `#77B5FE`
- Heavy or sad: `#9B59B6` or `#5D6D7E`
- Mixed or complex: layered `#DDA0DD` and `#87CEEB`
- Neutral: `#C0C0C0`

Tests:

- [x] Unit test sentiment analyzer wrapper.
- [x] Unit test sentiment category thresholds.
- [x] Unit test aura color mapping.
- [x] Unit test recency weighting.
- [x] Unit test aura intensity.

Deliverable:

- Every place has a 2D aura preview that updates when public memories are added.

## Phase 6: Advanced Privacy

Goal: implement the full privacy model described in the spec.

- [x] Add `Tagged` privacy type.
- [x] Add tagged user search.
- [x] Add tagged user selection during memory creation.
- [x] Add tagged memory visibility.
- [x] Add `Time-release` privacy type.
- [x] Add release date selector.
- [x] Add release date validation.
- [x] Add time-release visibility.
- [x] Add `Community` privacy type.
- [x] Add community picker.
- [x] Add community visibility checks.
- [x] Add default privacy preference handling.
- [x] Update Firestore rules for all privacy modes.

Tests:

- [x] Unit test tagged visibility.
- [x] Unit test time-release visibility before release date.
- [x] Unit test time-release visibility after release date.
- [x] Unit test community visibility.
- [ ] Security rules tests for all privacy modes.

Deliverable:

- Users can choose public, private, tagged, time-release, or community memory visibility.

## Phase 7: AR Prototype

Goal: implement the first AR experience with aura zones and memory orbs.

- [x] Add AR availability detection.
- [x] Add non-AR fallback to 2D map.
- [x] Add AR permissions flow.
- [x] Add AR screen.
- [x] Start and stop AR sessions safely.
- [x] Query nearby places for AR display.
- [x] Convert nearby place positions into AR anchors or relative scene positions.
- [x] Render aura dome or sphere.
- [x] Apply aura color and transparency.
- [x] Add aura pulse animation.
- [x] Render memory orbs inside aura.
- [x] Limit visible orbs for performance.
- [x] Add tap handling on aura.
- [ ] Add tap handling on memory orb.
- [ ] Open memory detail from orb tap.
- [x] Add distance and direction indicators.

Performance requirements:

- [ ] Maintain 30 FPS on target Android devices.
- [x] Avoid rendering too many places at once.
- [x] Avoid rendering too many memory orbs at once.
- [ ] Cache thumbnails and metadata.

Tests:

- [ ] Manual test on ARCore-supported Android device.
- [ ] Manual test on non-AR device.
- [ ] Manual test app lifecycle during AR session.
- [ ] Performance test with multiple nearby places.

Deliverable:

- Users can enter AR mode and see aura zones and memory orbs near real places.

## Phase 8: Communities

Goal: add shared memory spaces and community-based access.

- [x] Implement community list screen.
- [x] Implement community detail screen.
- [x] Implement thematic community creation.
- [x] Implement membership join flow.
- [x] Implement owner role.
- [x] Implement guardian role.
- [x] Implement member role.
- [x] Implement visitor role.
- [x] Implement community feed.
- [x] Add community badge component.
- [x] Add community privacy to memory creation.
- [x] Add geographic community placeholder.
- [x] Add time-based community placeholder.
- [x] Add institution zone placeholder.

Later community automation:

- [ ] Auto-create geographic communities when 5+ memories exist in 100m radius.
- [ ] Auto-create time-based communities based on memory timestamps.
- [ ] Add verified institution admin flow.
- [ ] Add alumni domain validation.
- [ ] Add campus building sub-zones.
- [ ] Add era groups.

Tests:

- [x] Unit test community role permissions.
- [x] Widget test community creation.
- [ ] Integration test joining community.
- [ ] Integration test community memory visibility.

Deliverable:

- Users can create, join, and view thematic communities with role-aware permissions.

## Phase 9: Custodianship and Legacy

Goal: implement place custodianship and legacy transfer.

- [x] Show custodians on place detail.
- [x] Allow custodian to invite another custodian.
- [x] Allow custodian to initiate transfer.
- [x] Create pending transfer document.
- [x] Notify recipient in app.
- [x] Allow recipient to accept transfer.
- [x] Allow recipient to reject transfer.
- [x] Allow initiator to revoke transfer within 7 days.
- [x] Log transfer history.
- [x] Allow multiple custodians per place.
- [x] Add guardian reassignment placeholder.

Transfer states:

- `pending`
- `accepted`
- `rejected`
- `revoked`
- `expired`

Tests:

- [x] Unit test transfer state machine.
- [x] Unit test revoke window.
- [ ] Security rules test transfer initiation.
- [ ] Security rules test transfer acceptance.
- [ ] Integration test successful transfer.

Deliverable:

- Custodianship can be passed from one user to another with history.

## Phase 10: Offline Cache and Sync

Goal: improve reliability on mobile networks.

- [x] Enable Firebase offline persistence where supported.
- [ ] Cache nearby places.
- [ ] Cache recent memories.
- [ ] Cache profile and settings.
- [ ] Add local image caching.
- [x] Add pending upload queue.
- [x] Retry failed memory uploads.
- [ ] Add sync status indicators.
- [ ] Add cache management settings.

Recommended local storage:

- Use Firebase local persistence for basic Firestore caching.
- Add `drift` or `isar` only when richer offline querying is needed.

Tests:

- [ ] Manual offline browsing test.
- [ ] Manual failed upload retry test.
- [ ] Unit test sync queue state.

Deliverable:

- Users can browse recently loaded content and recover from failed uploads.

## Phase 11: Notifications

Goal: support transfer and community workflows.

- [ ] Add Firebase Cloud Messaging.
- [ ] Request notification permissions.
- [ ] Notify users of transfer requests.
- [ ] Notify users of accepted transfers.
- [ ] Notify users when tagged in memories.
- [ ] Notify users of community invitations.
- [x] Add notification settings.

Deliverable:

- Users receive useful notifications for collaboration and legacy flows.

## Phase 12: Accessibility and UX Polish

Goal: make the app comfortable, legible, and accessible.

- [ ] Verify 44x44dp minimum touch targets.
- [ ] Add semantic labels.
- [ ] Support text scaling.
- [ ] Add high contrast support.
- [ ] Verify screen reader navigation.
- [ ] Add empty states.
- [ ] Add loading states.
- [ ] Add error recovery states.
- [ ] Polish dark theme.
- [ ] Polish aura animations.
- [ ] Reduce UI chrome in AR mode.

Deliverable:

- App meets baseline accessibility and usability expectations.

## Phase 13: Performance and Hardening

Goal: make the app reliable on target devices.

- [ ] Measure app launch time.
- [ ] Keep launch under 3 seconds.
- [ ] Measure memory load time.
- [ ] Keep memory load under 2 seconds.
- [ ] Measure location update time.
- [ ] Keep location updates under 1 second.
- [ ] Measure AR frame rate.
- [ ] Keep AR at 30+ FPS.
- [ ] Test on mid-range Android devices.
- [ ] Optimize image compression.
- [ ] Optimize Firestore query counts.
- [ ] Add crash reporting.
- [ ] Add analytics with privacy review.

Deliverable:

- App meets the non-functional requirements in the spec.

## Testing Plan

### Unit Tests

- [x] Auth repository
- [x] Memory validation
- [x] Privacy visibility
- [x] Place matching
- [x] Sentiment classification
- [x] Aura calculation
- [x] Community role permissions
- [x] Legacy transfer state machine

### Widget Tests

- [x] Login screen
- [x] Register screen
- [x] Add memory screen
- [x] Privacy selector
- [x] Memory card
- [x] Memory detail
- [ ] Place detail
- [ ] Community detail

### Integration Tests

- [ ] Sign up
- [ ] Sign in
- [ ] Add memory
- [ ] View place
- [ ] View memory detail
- [ ] Edit memory
- [ ] Soft delete memory
- [ ] Join community
- [ ] Create community memory
- [ ] Transfer custodianship

### Security Rules Tests

- [ ] Public memory read
- [ ] Private memory read denied to other users
- [ ] Private memory read allowed to creator
- [ ] Tagged memory read allowed to tagged user
- [ ] Tagged memory read denied to untagged user
- [ ] Time-release memory hidden before release
- [ ] Time-release memory public after release
- [ ] Community memory restricted to members
- [ ] Memory location update denied
- [ ] Custodian moderation allowed

### Manual Device Tests

- [ ] Android emulator smoke test
- [ ] Android physical device test
- [ ] Target mid-range Android performance test
- [ ] iOS simulator smoke test
- [ ] iOS physical device test, if available
- [ ] ARCore supported-device test
- [ ] Non-AR fallback test
- [ ] Camera permission test
- [ ] Gallery permission test
- [ ] Location permission test
- [ ] Notification permission test

## Main Risks and Mitigations

### AR Plugin Risk

AR dependencies may behave differently across Android and iOS.

Mitigation:

- [ ] Build AR only after MVP is stable.
- [ ] Add AR availability detection.
- [ ] Keep 2D map as complete fallback.
- [ ] Test on real target Android hardware.

### Privacy Query Complexity

Firestore queries can become difficult when combining public, private, tagged, community, and time-release visibility.

Mitigation:

- [ ] Keep separate query paths for each visibility type.
- [ ] Enforce access with security rules.
- [ ] Add security rules tests before broad feature work.
- [ ] Avoid relying only on client-side filtering.

### Sentiment Package Risk

The Dart VADER package may not fully match project requirements.

Mitigation:

- [x] Wrap sentiment analysis behind an interface.
- [ ] Add deterministic unit tests.
- [ ] Allow replacing the implementation without touching feature code.

### Place Matching Risk

Nearby memories may attach to the wrong place if radius logic is too simple.

Mitigation:

- [ ] Start with conservative radius matching.
- [ ] Store geohash and exact coordinates.
- [ ] Add custodian merge/split tools later.

### Performance Risk

AR, image loading, and Firestore queries can strain mid-range phones.

Mitigation:

- [ ] Cap rendered AR objects.
- [ ] Compress images.
- [ ] Cache aggressively.
- [ ] Profile on physical devices early.

## Release Milestones

### Internal Alpha

- [ ] Auth
- [ ] Profile
- [ ] Map
- [ ] Add memory
- [ ] Place detail
- [ ] Public/private privacy
- [ ] Basic aura preview

### Private Beta

- [ ] Advanced privacy
- [ ] AR prototype
- [ ] Memory editing
- [ ] Soft delete
- [ ] Initial community support
- [ ] Firebase security rules test coverage

### Public MVP

- [ ] Stable AR fallback
- [ ] Thematic communities
- [ ] Custodianship basics
- [ ] Offline cache basics
- [ ] Accessibility pass
- [ ] Performance pass on target devices

### Post-MVP

- [ ] Institution zones
- [ ] Era groups
- [ ] Legacy transfer polish
- [ ] Community analytics
- [ ] Discussion board, if requested
- [ ] Audio playback in AR
- [ ] Multi-language support
- [ ] Web portal

## Immediate Next Steps

- [x] Add profile-backed default privacy coverage in add-memory tests.
- [x] Start Firebase service adapters behind existing repositories.
- [x] Move Firebase native config files into platform folders and keep private/admin keys out of git.
