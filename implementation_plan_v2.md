# ECHOES — TDD Implementation Plan v2

**Generated**: July 7, 2026  
**Basis**: Full codebase audit (see `status.md`), user request for production-complete product  
**Methodology**: Test-Driven Development — write failing test (🔴), implement minimal code (🟢), refactor, commit  
**Parallelism**: Phases are ordered by dependency; within each phase, tracks are designed to run in parallel by different agents

---

## Dependency Graph (What blocks what)

```
Phase 0 (Foundation Fixes)
  ├── Track A: Firestore indexes          → blocks all Firestore production queries
  ├── Track B: Place geo-query optimization → blocks map + AR performance
  ├── Track C: Firebase config + CI fixes  → blocks release pipeline
  └── Track D: Dependency version fixes    → blocks all builds
       │
Phase 1 (Critical Features)
  ├── Track A: Google Maps widget          → blocks map UX
  ├── Track B: Memories `list` rules fix   → blocks privacy correctness
  ├── Track C: EditMemorySheet full privacy → blocks memory management
  ├── Track D: MemoryCard privacy labels   → blocks UX completeness
  └── Track E: Sentiment analyzer upgrade  → blocks spec compliance
       │
Phase 2 (Unblocked Features)
  ├── Track A: Audio recording + upload    → blocks SPEC audio feature
  ├── Track B: Aura history storage + UI   → blocks SPEC aura history
  ├── Track C: Community memory feed       → blocks community UX
  ├── Track D: Stubbed features (3 items)  → blocks feature completeness
  └── Track E: Institution UI screens      → blocks institution feature
       │
Phase 3 (AR Real Implementation)
  ├── Track A: ARCore/ARKit native wiring  → blocks 3D AR rendering
  └── Track B: AR testing + performance    → blocks AR deliverable
       │
Phase 4 (Integration + Device Testing)
  ├── Track A: Integration test suite      → blocks release confidence
  ├── Track B: Device smoke tests          → blocks release readiness
  └── Track C: Performance measurement     → blocks spec compliance
       │
Phase 5 (Production Hardening)
  ├── Track A: Auto-retry uploads          → blocks offline UX
  ├── Track B: Error handling audit        → blocks reliability
  ├── Track C: Full-text search            → blocks user search
  └── Track D: Performance optimization    → blocks spec compliance
```

---

## Phase 0: Foundation Fixes (CRITICAL — must come first)

**Goal**: Fix blockers that will crash in production or block development.  
**TDD**: Write tests that demonstrate the bugs/omissions, then fix.

### Track A: Firestore Composite Indexes 🔴 HIGH

Reference: `status.md` — "No Firestore indexes defined — queries where + orderBy + limit will fail in production"

**User story**: As a developer deploying to production, I want Firestore composite indexes declared so that all compound queries succeed without errors.

**Test plan** (TDD Step 1 — 🔴):
```dart
// firestore_indexes_test.dart
// Validate index requirements for each compound query by enumerating query patterns:
test('memories collection has required composite indexes', () {
  // Query patterns used in code:
  // 1. .where('placeId', ==).where('isDeleted', ==).orderBy('createdAt', desc).limit(50)
  // 2. .where('placeId', ==).where('isDeleted', ==).where('privacy', ==).limit(50)
  // 3. .where('placeId', ==).where('isDeleted', ==).where('userId', ==).limit(50)
  // 4. .where('placeId', ==).where('isDeleted', ==).where('taggedUserIds', arrayContains).limit(50)
  // 5. .where('placeId', ==).where('isDeleted', ==).where('privacy', ==).where('releaseDate', <=).limit(50)
  // 6. .where('placeId', ==).where('isDeleted', ==).where('privacy', ==).where('communityId', 'in').limit(50)
  // 7. .where('userId', ==).where('isDeleted', ==).orderBy('createdAt', desc).limit(50)
  // 8. .where('toUserId', ==).where('status', ==)  [transfers]
  // 9. collectionGroup('members').where(FieldPath.documentId, ==) [communities]
  // Validate each against firestore.indexes.json
});
```

**Implementation** (TDD Step 2 — 🟢):
- Create `firestore.indexes.json` with all composite indexes
- Index specifications:
  ```json
  [
    {
      "collectionGroup": "memories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "placeId", "order": "ASCENDING" },
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "memories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "placeId", "order": "ASCENDING" },
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "privacy", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "memories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "placeId", "order": "ASCENDING" },
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "memories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "placeId", "order": "ASCENDING" },
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "taggedUserIds", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "memories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "placeId", "order": "ASCENDING" },
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "privacy", "order": "ASCENDING" },
        { "fieldPath": "releaseDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "memories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "placeId", "order": "ASCENDING" },
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "privacy", "order": "ASCENDING" },
        { "fieldPath": "communityId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "memories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transfers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "toUserId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "members",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "__name__", "order": "ASCENDING" }
      ]
    }
  ]
  ```
- Add index validation test that parses `firestore.indexes.json` and verifies required patterns

**Files to create/modify**:
- `firestore.indexes.json` (create)
- `test/firestore/firestore_indexes_test.dart` (create)

---

### Track B: Place Geo-Query Optimization 🔴 HIGH

Reference: `status.md` — "FirestorePlaceRepository.findNearestPlace loads ALL documents up to 100 limit and filters client-side"

**User story**: As a user near many places, I want the app to efficiently find nearby places so the map loads quickly even with thousands of places globally.

**Test plan** (TDD):
```dart
// test/features/places/domain/nearby_place_query_test.dart
test('geohash prefix narrows query bounds', () {
  final query = NearbyPlaceQuery.fromLocation(
    latitude: 12.9716, longitude: 77.5946,
    radiusMeters: 100,
  );
  expect(query.geohashPrefix, 'tdr1v'); // exact prefix for 100m radius
});

test('geohash precision adapts to radius', () {
  // radius 100m → precision 6
  // radius 500m → precision 5
  // radius 2000m → precision 4
});
```

**Implementation**:
- Modify `NearbyPlaceQuery.fromLocation` to compute an appropriate geohash prefix length based on radius (≈ 5 chars for 1km, 6 for 200m, 7 for 50m)
- Modify `FirestorePlaceRepository.findNearestPlace` and `watchNearbyPlaces` to filter by geohash prefix using `where('geohash', '>=', prefix).where('geohash', '<', prefix + 'z')` instead of loading all
- Add Haversine post-filter for exact distance within the geohash-bounded result set
- Store geohash on place documents (already stored — verify)

**Files to modify**:
- `lib/features/places/domain/nearby_place_query.dart`
- `lib/features/places/data/firestore_place_repository.dart`
- Add geohash query test in `test/features/places/data/firestore_place_repository_test.dart`

---

### Track C: Firebase Config + CI Fixes 🟡 MEDIUM

**User story**: As a developer, I want Firebase config files properly handled and CI fast so I can deploy without manual steps.

**Items**:
1. Add `firebase.indexes.json` deployment to CI workflow
2. Verify CI runs all tests correctly
3. Ensure firebase_options.dart can be regenerated (document `flutterfire configure`)
4. Fix pubspec pinned dependencies to use `^` semver ranges

**Files to modify**:
- `.github/workflows/flutter.yml`
- `pubspec.yaml` (unpin 3 dependencies: `permission_handler: ^12.0.1`, `arcore_flutter_plus: ^1.0.2`, `arkit_plugin: ^1.3.0`)
- Add `git add` for firestore.indexes.json deployment step

---

### Track D: MemoryDTO Date Serialization Fix 🟡 MEDIUM

Reference: "Memory dates stored as ISO strings — works but differs from Firestore Timestamp"

**User story**: As a developer, I want memory dates stored as Firestore Timestamps so they integrate correctly with Firestore date queries (including existing `releaseDate` comparisons).

**Test plan** (TDD):
```dart
// In firestore_memory_repository_test.dart
test('stores dates as firestore timestamps for queries', () async {
  // Create memory, verify Firestore stores Timestamp not String
});
```

**Implementation**:
- Modify `MemoryDto.toMap()` to serialize dates as `Timestamp.fromDate()` instead of ISO strings
- Modify `MemoryDto.fromMap()` to accept both `Timestamp` and `String` for backward compatibility
- Update all comparison queries that use string dates

**Files to modify**:
- `lib/features/memories/data/memory_dto.dart`
- `lib/features/places/data/place_dto.dart`
- `lib/features/aura/data/aura_zone_dto.dart`
- `lib/features/aura/data/aura_history_entry_dto.dart`
- `lib/features/aura/data/sentiment_result_dto.dart`
- `lib/features/communities/data/community_dto.dart`
- `lib/features/communities/data/community_membership_dto.dart`
- `lib/features/legacy/data/legacy_transfer_dto.dart`
- `lib/features/users/data/app_user_dto.dart`

---

## Phase 1: Critical Features (individually parallelizable)

**Prerequisite**: Phase 0 complete (indexes + geo-query fix + DTO fixes)  
**TDD**: Each track follows its own 🔴→🟢 cycle

### Track A: Google Maps Widget 🟡 MEDIUM

Reference: "Map screen renders a list-based panel instead of Google Maps widget"

**User story**: As a user, I want to see nearby memory places on an actual map with colored markers so I can intuitively discover places near me.

**Test plan** (TDD):
```dart
// test/features/map/presentation/map_placeholder_screen_test.dart
testWidgets('shows GoogleMap when state is ready', (tester) async {
  // Provide MapState.ready with location + places
  // Verify GoogleMap widget is rendered instead of list
});

testWidgets('map markers have aura colors', (tester) async {
  // Verify markers use AuraMarkerHue for coloring
});
```

**Implementation**:
- Modify `_ReadyMapPlaceholder` to render `GoogleMap` widget with:
  - Initial camera position at user location
  - Markers for each place with aura-colored pins (using `AuraMarkerHue`)
  - Current location marker/dot enabled
  - Info windows or tap handlers for place details
- Keep the `_NearbyPlacesPanel` list as a collapsible bottom sheet overlay
- Remove the `import 'package:permission_handler/permission_handler.dart'` that was used for openAppSettings fallback (keep using MapCubit's flow)

**Files to modify**:
- `lib/features/map/presentation/map_placeholder_screen.dart`
- `lib/features/map/presentation/aura_marker_hue.dart` (already exists — integrate it)
- Remove unused imports

---

### Track B: Memories `list` Rule Fix 🟡 MEDIUM

Reference: "`allow list: if signedIn()` returns all non-deleted memories regardless of privacy"

**User story**: As a user, I want to only see memories I'm allowed to see when browsing by place so my privacy is respected on the server side.

**Test plan** (TDD):
```dart
// rules_test/firestore.rules.test.js
test('list query filters by privacy rules', async () => {
  // Authenticated stranger lists memories for a place
  // Should only see public + time-release that has passed + tagged if tagged
  // Should NOT see private or future time-release or non-member community
});
```

**Implementation**:
- Firestore rules cannot fully filter `list` queries (security rules are not filters — they reject the entire query if any matching doc could fail the rule)
- **Strategy**: Change from a single list rule to enforcing that the client must include a privacy filter in the query, and validate that filter:
  ```javascript
  match /memories/{memoryId} {
    allow list: if signedIn() && (
      // Client MUST filter by at least one allowed privacy type
      request.query.privacy in ['public'] ||
      request.query.privacy in ['timeRelease'] ||
      (request.query.privacy in ['tagged'] && request.auth.uid in request.query.taggedUserIds) ||
      (request.query.privacy in ['community'] && request.query.communityId != null)
    );
  }
  ```
- Update `FirestoreMemoryRepository` to use separate list queries per privacy type for place browsing (already done on the data access side, but the rules must allow it)
- Add rules test for each query pattern

**Files to modify**:
- `firestore.rules`
- `rules_test/firestore.rules.test.js`

---

### Track C: EditMemorySheet Full Privacy Support 🟡 MEDIUM

Reference: "Only supports public/private toggle — doesn't support tagged, timeRelease, community"

**User story**: As a user, I want to edit all privacy settings on my memories, not just public/private, so I have full control over who sees my content.

**Test plan** (TDD):
```dart
// test/features/memories/presentation/edit_memory_sheet_test.dart
testWidgets('shows all privacy options on owned memory', (tester) async {
  // Verify all 5 privacy options are available in segmented button
});

testWidgets('saves tagged privacy with user IDs', (tester) async {
  // Select tagged mode, add user ID, save
  // Verify repository.updateTextAndPrivacy called with tagged params
});

testWidgets('saves community privacy with community ID', (tester) async {
  // Select community mode, pick community, save
  // Verify repository called with community params
});
```

**Implementation**:
- Modify `EditMemorySheet` to use the same 5-option `SegmentedButton<PrivacyType>` as the add screen
- Add `_TaggedUserInput`, `_ReleaseDateInput`, and `_CommunityPicker` sub-widgets (extract from AddMemoryPlaceholderScreen to shared if possible)
- Update `_save` to pass all privacy params to `updateTextAndPrivacy`

**Files to modify**:
- `lib/features/memories/presentation/edit_memory_sheet.dart`
- `lib/features/memories/presentation/edit_memory_sheet_test.dart` (create)

---

### Track D: MemoryCard Privacy Labels 🟡 LOW

Reference: "Only shows Public/Private — doesn't display Tagged, TimeRelease, or Community"

**User story**: As a user, I want to see the exact privacy setting on each memory card so I know who can see it.

**Test plan** (TDD):
```dart
testWidgets('shows correct label for each privacy type', (tester) async {
  // Test public → "Public"
  // Test private → "Private"
  // Test tagged → "Tagged (N users)"
  // Test timeRelease → "Releases on DD/MM/YYYY"
  // Test community → "Campus Keepers" (community name)
});
```

**Implementation**:
- Modify `MemoryCard` to show the actual privacy label:
  - `PrivacyType.tagged` → "Tagged (${memory.taggedUserIds.length} user)"
  - `PrivacyType.timeRelease` → "Releases ${_formatDate(memory.releaseDate)}"
  - `PrivacyType.community` → "Community (${memory.communityId})"
- Pass `communityName` optionally to MemoryCard or resolve from CommunityRepository

**Files to modify**:
- `lib/features/memories/presentation/memory_card.dart`
- `test/features/memories/presentation/memory_card_test.dart`

---

### Track E: Sentiment Analyzer — Real VADER Integration 🟡 MEDIUM

Reference: "Custom word-list — NOT VADER as spec requires; limited to ~30 positive/negative words"

**User story**: As a user, I want accurate sentiment analysis on my memory text that handles negations (e.g., "not happy"), intensifiers ("very good"), and the full English sentiment spectrum.

**Research first**: Use `researcher_docs` to find available VADER Dart packages.

**Test plan** (TDD):
```dart
// test/features/aura/data/lexicon_sentiment_analyzer_test.dart (extend)
test('handles negation correctly', () {
  expect(analyzer.analyze('not happy').compound, lessThan(0));
});

test('handles intensifiers', () {
  expect(analyzer.analyze('very good').compound, greaterThan(analyzer.analyze('good').compound));
});

test('handles mixed sentiment', () {
  final result = analyzer.analyze('Beautiful day but I feel sad');
  expect(result.category, SentimentCategory.mixed);
});
```

**Implementation**:
- Option A: Add `dart_vader` package and use it as a replacement or wrapper
- Option B: Significantly expand the lexicon (100+ words) and add negation/intensifier/booster logic
- Keep the `SentimentAnalyzer` interface — swap implementations behind it
- Retrofit `LexiconSentimentAnalyzer` or create `VaderSentimentAnalyzer`

**Files to modify**:
- `pubspec.yaml` (add `dart_vader` if available)
- `lib/features/aura/data/lexicon_sentiment_analyzer.dart` (expand or wrap VADER)
- `test/features/aura/data/lexicon_sentiment_analyzer_test.dart` (extend)
- `lib/features/aura/domain/sentiment_result.dart` (verify category threshold alignment with VADER)

---

## Phase 2: Feature Completeness (parallelizable within phase)

**Prerequisite**: Phase 1 complete (Map works, privacy fully functional)  
**TDD**: Each track follows its own 🔴→🟢 cycle

### Track A: Audio Recording + Upload + Playback 🟡 MEDIUM

Reference: "Memory.audioUrl exists in domain but no UI to record, upload, or play audio"

**User story**: As a user, I want to record a voice note (max 60 seconds) when creating a memory so I can capture spoken emotions that text can't convey.

**Sub-tasks**:
1. Add audio recording dependency (`record` or `flutter_sound` package) via Gravity Index
2. Create audio recording service (data layer)
3. Create audio upload service (storage layer)
4. Add audio capture UI to add memory screen
5. Add audio playback UI to memory detail screen
6. Add audio duration validation (max 60s)
7. Write tests for recording/playback services

**Implementation order**:
1. `gravity_index` search for Flutter audio recording packages
2. Write test for audio service interface → implement
3. Write widget test for record button → add to AddMemoryScreen
4. Write widget test for play button → add to MemoryDetailSheet

---

### Track B: Aura History Storage + Display 🟡 MEDIUM

Reference: "Entity/DTO exist but no repository or UI"

**User story**: As a user, I want to see how a place's aura has evolved over time so I can understand the changing emotional character of a location.

**Sub-tasks**:
1. Add `AuraHistoryRepository` (Firestore collection `auraHistory/{entryId}`)
   - `recordAuraSnapshot(placeId, aura)` — called after memory creation
   - `watchAuraHistory(placeId, limit: 30)` — stream of history entries
2. Integrate snapshot recording into `AddMemoryCubit.submit()` after aura calculation
3. Build `AuraHistoryChart` widget (simple bar/line chart showing sentiment over time)
4. Add chart to `PlaceDetailSheet` between aura preview and custodians
5. Add `AuraHistoryRepository` to `EchoesApp` dependency injection

---

### Track C: Community Memory Feed 🟡 MEDIUM

Reference: "CommunityDetailScreen shows placeholder text"

**User story**: As a community member, I want to see a feed of all memories shared within the community so I can browse its archive.

**Sub-tasks**:
1. Add `watchCommunityMemories(communityId)` to `MemoryRepository` interface
2. Implement in `FirestoreMemoryRepository` — query `/memories` where `communityId == id && isDeleted == false`
3. Implement in `LocalMemoryRepository`
4. Update `CommunityDetailScreen` to show a `StreamBuilder<List<Memory>>` with MemoryCards
5. Add pull-to-refresh for the feed

---

### Track D: Activate All Stubbed Features 🟡 LOW

Reference: 3 disabled/stubbed features in the profile and place detail

**Items**:
1. **Account Deletion** — wire `deleteAccountPlaceholderButton` to:
   - Confirm dialog
   - Delete user's Firestore documents (memories, places where sole custodian)
   - Firebase `user.delete()` or re-authentication flow
   - Sign out

2. **30-Day Memory Restore** — wire `restoreMemoryPlaceholderButton` to:
   - Query soft-deleted memories for current user
   - Allow un-delete (set `isDeleted = false`, `deletedAt = null`)
   - Show restore option only if `deletedAt` is within 30 days

3. **Guardian Reassignment** — wire `guardianReassignmentPlaceholderButton` to:
   - Modal sheet showing current custodians
   - Ability to remove a custodian (only for guardians/owners of the community)
   - Requires community role check

---

### Track E: Institution Zone UI Screens 🟡 LOW

Reference: "Domain/service written — no UI screens"

**User story**: As an institution member, I want to see and interact with my institution zone so I can explore campus memories.

**Sub-tasks**:
1. Build `InstitutionListScreen` — shows available institution zones
2. Build `InstitutionDetailScreen` — shows sub-zones (buildings), memories per zone
3. Add institution verification flow (email domain check → admin verification)
4. Add institution entry points in Communities screen or a new section
5. Add `InstitutionRepository` for Firestore persistence

---

## Phase 3: AR Real Implementation (sequential, device-dependent)

**Prerequisite**: Phase 2 complete (all features working)  
**Requires**: Real Android device with ARCore for testing

### Track A: ARCore/ARKit Native Wiring 🔴 HIGH

Reference: "AR is entirely a 2D mockup — no ARCore/ARKit integration"

**User story**: As a user with an ARCore-compatible phone, I want to see real 3D aura domes and memory orbs through my camera so I can experience memories in their actual location.

**Sub-tasks**:
1. Research: Use `researcher_docs` to read latest API docs for `arcore_flutter_plus` and `arkit_plugin`
2. Replace `LocalArSessionService` with actual `ArcoreFlutterPlus` / `ArkitPlugin` session management
3. Replace `_ArScenePainter` (CustomPaint) with actual 3D scene using AR platform widgets
4. Map aura zones as 3D semi-transparent domes at GPS locations
5. Map memory orbs as 3D floating spheres within aura domes
6. Wire gesture detection (tap on aura → expand orbs, tap on orb → memory detail)
7. Wire camera permission flow (already exists in ArCubit)

---

### Track B: AR Performance Optimization

**User story**: As a user on a mid-range phone, I want AR mode to stay at 30+ FPS even with many nearby places.

**Sub-tasks**:
1. Profile AR frame rate on target device
2. Implement LOD (level of detail): reduce orb count and aura polygon count for distant places
3. Implement scene culling: only render places within 200m
4. Implement occlusion: hide auras behind real-world objects (ARCore depth API)
5. Add performance metrics overlay for development

---

## Phase 4: Integration + Device Testing

**Prerequisite**: Phases 0-2 complete (all code written)

### Track A: Integration Test Suite ❌ MISSING

Reference: "No device or integration tests — 10 integration test items listed"

**User story**: As a developer, I want integration tests that verify complete user flows so I can release with confidence.

**Implementation**:
Create `integration_test/` directory with these test suites (using `integration_test` package):

| Test | Flow | Key Assertions |
|------|------|----------------|
| `sign_up_test.dart` | Launch → Auth screen → Register → Home | Home shell visible, profile shows user name |
| `sign_in_test.dart` | Launch → Auth screen → Sign in → Map | Map area visible, location prompt shown |
| `add_memory_test.dart` | Home → Add tab → Capture location → Write text → Select privacy → Save | Memory appears in profile list |
| `view_place_test.dart` | Map → tap place → Place detail sheet | Aura preview, memories list, custodians visible |
| `edit_memory_test.dart` | Profile → tap memory → Edit → Change text → Save | Text updated, old text gone |
| `soft_delete_memory_test.dart` | Profile → tap memory → Delete | Memory gone from profile list |
| `join_community_test.dart` | Communities → tap community → Join | Join button disabled, feed visible |
| `create_community_memory_test.dart` | Add → Select community privacy → Pick community → Save | Memory visible in community feed |
| `transfer_custodianship_test.dart` | Place → Transfer → Enter recipient → Send → Profile → Accept | Recipient appears in custodians list |
| `notification_settings_test.dart` | Profile → Notifications → Toggle | Toggles update, permission banner responds |

**TDD approach**: 
1. Write each test → 🔴 (fails because no integration test harness yet)
2. Configure `integration_test` package + test driver
3. Run on emulator → 🟢

**Setup**:
```yaml
# pubspec.yaml dev_dependencies
dev_dependencies:
  integration_test:
    sdk: flutter
  flutter_test:
    sdk: flutter
```

```bash
flutter test integration_test/
```

---

### Track B: Device Smoke Tests ❌ MISSING

Reference: "11 manual device test items listed"

**Test matrix** (run on each target device):

| Device | OS | ARCapable | Test Items |
|--------|-----|-----------|------------|
| Pixel 6/7 | Android 14+ | Yes | All flows + AR |
| Redmi Note 12 | Android 13 | Yes | Performance + AR |
| Samsung A-series | Android 12-14 | Yes | All flows + AR |
| Non-AR phone | Android 11+ | No | All flows + fallback |
| iPhone 13+ | iOS 16+ | Yes | All flows + AR |

**Smoke checklist** (documented in README):
- Sign up, sign in
- Grant/deny location → correct UI state
- Add text memory with location
- Add image memory (camera + gallery)
- View place detail + memory detail
- Edit memory text/privacy
- Soft-delete a memory
- Join community, create community memory
- Initiate + accept custodianship transfer
- Toggle notification settings
- Launch AR on ARCore device → see auras
- Launch AR on non-AR device → see fallback map suggestion
- Airplane mode → cached content still visible
- Network restore → pending uploads retry automatically (once Phase 5A is done)

---

### Track C: Performance Measurement ❌ MISSING

Reference: "No metrics collected for launch time, memory load, location update, AR FPS"

**Tooling**: Use Flutter DevTools + manual stopwatch on device

**Measurements to capture**:

| Metric | Target | Method |
|--------|--------|--------|
| App launch (cold start) | < 3s | `adb logcat` ActivityManager display time |
| Place list load | < 2s | `Stopwatch` in MapCubit.requestLocation |
| Memory list load | < 2s | `Stopwatch` in place detail stream first emission |
| Location update | < 1s | `Stopwatch` in GeoLocationService |
| AR FPS | 30+ | `flutter build apk --profile` + DevTools FPS overlay |
| Image download + display | < 3s | `imageLoadingBuilder` timing capture |
| Memory save + aura recalc | < 5s | `Stopwatch` in AddMemoryCubit.submit |
| Firestore query latency | < 500ms | Firebase Performance monitoring |

---

## Phase 5: Production Hardening (final polish)

**Prerequisite**: All features working and tested on device

### Track A: Auto-Retry Failed Uploads ❌ MISSING

Reference: "PendingMemoryUploadSync is never auto-triggered, only via manual retry button"

**User story**: As a user with intermittent connectivity, I want my memory photos to upload automatically when the network recovers so I don't have to manually retry.

**Implementation**:
1. Add a `connectivity_plus` or similar package to detect network state changes
2. In `PendingMemoryUploadSync`, listen to connectivity stream and call `retryPendingUploads()` when connectivity returns
3. Add rate limiting (retry at most once every 30 seconds)
4. Add max retry count (stop after 10 attempts, keep in queue for manual retry)

---

### Track B: Error Handling Audit 🟡 MEDIUM

Reference: "Error type erasure, inconsistent catch patterns"

**User story**: As a user, I want clear, actionable error messages when things go wrong so I can recover without confusion.

**Audit items**:
1. Replace `Exception(error.message ?? error.code)` in `FirebaseAuthRepository` with typed domain exceptions
2. Review all `catch (error)` blocks throughout codebase — ensure errors are:
   - Logged via crash reporting service
   - Presented as user-friendly messages (not raw Dart exception strings)
   - Not silently swallowed
3. Add retry buttons to all failure states (map, AR, memory detail)
4. Add network connectivity-aware error messages ("You appear offline — saved for when you're back online")

---

### Track C: Full-Text Search for Users 🟡 MEDIUM

Reference: "Tagged user search loads all users and filters client-side"

**User story**: As a user tagging someone in a memory, I want to search for users by name or email efficiently so I can find them even in a large user base.

**Implementation**:
- Option A (simple): Add Firestore `displayName` and `email` as searchable fields with `where('displayName', '>=', query).where('displayName', '<', query + 'z')` prefix matching
- Option B (better): Use Firebase Extensions (MeiliSearch or Algolia) for full-text search
- Option C (if B is too heavy): Add a `searchTokens` array field to user documents with n-gram tokens for prefix matching

---

### Track D: Performance Optimization 🔴 HIGH (for compliance)

Reference: "Performance pass on target devices" still incomplete

**Sub-tasks**:
1. **Image pipeline optimization**: Pre-generate thumbnails (150x150px) during upload, serve thumbnails in list views, full-res only in detail
2. **Query consolidation**: Review all Firestore queries — add `.limit()` where missing, verify index usage
3. **Widget rebuild optimization**: Audit `BlocBuilder` scope — narrow rebuild boundaries
4. **Memory management**: Implement `ImageCache` size management (` PaintingBinding.instance!.imageCache.maximumSize = 100`)
5. **Deferred loading**: Lazy-load community feeds and memory lists with pagination (Firestore cursor-based)

---

## Parallel Execution Strategy

Use multiple agents working in parallel as follows:

### Wave 1 (Start immediately — 4 parallel agents)
| Agent | Track | Estimated Time |
|-------|-------|----------------|
| Agent A | Phase 0-A: Firestore indexes + test | 1-2h |
| Agent B | Phase 0-B: Geo-query optimization | 2-3h |
| Agent C | Phase 0-C: CI + pubspec fixes | 0.5-1h |
| Agent D | Phase 1-E: VADER research + implementation | 2-4h |

### Wave 2 (after Wave 1 — 3 parallel agents)
| Agent | Track | Estimated Time |
|-------|-------|----------------|
| Agent A | Phase 1-A: Google Maps widget | 4-6h |
| Agent B | Phase 1-C + 1-D: EditMemorySheet + MemoryCard privacy | 2-3h |
| Agent C | Phase 1-B: Memories `list` rules fix | 1-2h |

### Wave 3 (after Wave 2 — 4 parallel agents)
| Agent | Track | Estimated Time |
|-------|-------|----------------|
| Agent A | Phase 2-A: Audio recording/playback | 4-6h |
| Agent B | Phase 2-B: Aura history | 3-4h |
| Agent C | Phase 2-C: Community feed | 2-3h |
| Agent D | Phase 2-D: 3 stubbed features | 3-4h |

### Wave 4 (after Wave 3 — 2 parallel agents)
| Agent | Track | Estimated Time |
|-------|-------|----------------|
| Agent A | Phase 2-E: Institution UI | 3-4h |
| Agent B | Phase 0-D: Date serialization + DTO audit | 2-3h |

### Wave 5 (after everything above — 2 parallel agents)
| Agent | Track | Estimated Time |
|-------|-------|----------------|
| Agent A | Phase 4-A: Integration tests | 4-6h |
| Agent B | Phase 4-C + 5-D: Performance measurement + optimization | 4-6h |

### Wave 6 (final — 2 parallel agents)
| Agent | Track | Estimated Time |
|-------|-------|----------------|
| Agent A | Phase 5-A: Auto-retry uploads | 2-3h |
| Agent B | Phase 5-B + 5-C: Error audit + user search | 3-4h |

### Device-Dependent (blocking on hardware)
| Agent | Track | Estimated Time |
|-------|-------|----------------|
| Agent A | Phase 3: AR native implementation | 1-2 weeks |
| Agent B | Phase 4-B: Device smoke tests | 3-5 days |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ARCore/ARKit plugins don't work with Flutter 3.x SDK | High | Critical | Keep 2D canvas fallback; test early; have a non-AR mode as primary UX |
| VADER Dart package doesn't exist or is abandoned | Medium | Medium | Expand lexicon-based implementation with negation/intensifier logic |
| Firestore index creation takes hours in production | Certain | Medium | Create indexes via Firebase Console first, then add to `firestore.indexes.json` for CI |
| Integration tests flaky on CI | Medium | Medium | Use `integration_test` with retry logic; run against Firebase emulators |
| Mid-range device AR performance below 30 FPS | High | High | Aggressive LOD, distance culling, reduce orb count; make non-AR mode equally capable |
| Audio recording permissions on iOS require plist changes | Low | Low | Already documented; add `NSMicrophoneUsageDescription` to Info.plist |

---

## Success Criteria

**Gate 1 — Ready for Private Beta** (after Phase 2):
- ✅ All Firestore queries succeed in production (indexes deployed)
- ✅ Google Maps shows colored markers for all places
- ✅ All 5 privacy types fully editable in both create + edit flows
- ✅ Audio can be recorded and played back
- ✅ Aura history visible on place details
- ✅ Community feed shows memories
- ✅ Account deletion, memory restore, guardian reassignment all functional
- ✅ No disabled/stubbed buttons remaining

**Gate 2 — Ready for Public Beta** (after Phase 4):
- ✅ Integration tests pass on CI emulator
- ✅ All smoke tests pass on Pixel 6 / Redmi Note 12
- ✅ Launch < 3s, memory load < 2s, location < 1s on target devices
- ✅ App works offline (cached data visible, uploads queued + auto-retried)
- ✅ Error states all have recovery paths

**Gate 3 — Ready for Launch** (after Phase 5):
- ✅ AR mode renders 3D auras at 30+ FPS on ARCore-supported mid-range devices
- ✅ Non-AR devices show polished map experience with no degraded UX
- ✅ All error messages are user-friendly
- ✅ Analytics event surface reviewed and complete
- ✅ Crash reporting wired and verified
- ✅ Performance targets met on target devices

---

## Git Checkpoint Strategy (TDD Compliance)

Per the TDD workflow skill, each feature track creates these commits:

```
test: add failing test for <feature>      ← 🔴 RED
fix: implement <feature>                   ← 🟢 GREEN
refactor: clean up <feature>               ← cleanup
```

These commits should be on the active branch and not squashed until the full phase is complete.

**Exception**: For small fixes (< 10 lines), RED→GREEN can be a single commit with the message:
```
fix: <issue description> with verified test
```
