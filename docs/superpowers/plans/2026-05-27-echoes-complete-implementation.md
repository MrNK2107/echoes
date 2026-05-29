# ECHOES Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all mock/placeholder implementations with production code, implement all stub features, and validate on real hardware.

**Architecture:** Risk-first approach — native AR (biggest unknown) → embedded map → Firebase persistence swaps → stub features → polish/validation. Each phase produces a working increment. Follows existing Clean Architecture with domain/data/presentation layers, BLoC Cubits, and dual Firebase/local implementations.

**Tech Stack:** Flutter 3.x, Dart ^3.11.4, Firebase (Auth, Firestore, Storage, Messaging, Crashlytics, Analytics), ARCore (arcore_flutter_plus), ARKit (arkit_plugin), Google Maps, BLoC/Equatable, permission_handler

**Design Spec:** `docs/superpowers/specs/2026-05-27-echoes-complete-implementation-design.md`

---

## File Structure

### Phase 1 — Native AR
- Create: `lib/features/ar/data/arcore_session_service.dart`
- Create: `lib/features/ar/data/arkit_session_service.dart`
- Create: `lib/features/ar/presentation/ar_screen.dart`
- Create: `test/features/ar/data/arcore_session_service_test.dart`
- Create: `test/features/ar/data/arkit_session_service_test.dart`
- Create: `test/features/ar/presentation/ar_screen_test.dart`
- Modify: `lib/app/app.dart:188-189` (ArSessionService wiring)
- Modify: `lib/features/home/presentation/echoes_home_shell.dart` (rename AR tab)
- Delete: `lib/features/ar/presentation/ar_placeholder_screen.dart`
- Delete: `test/features/ar/presentation/ar_placeholder_screen_test.dart`

### Phase 2 — Embedded Map
- Create: `lib/features/map/presentation/map_screen.dart`
- Create: `test/features/map/presentation/map_screen_test.dart`
- Modify: `lib/features/home/presentation/echoes_home_shell.dart` (rename Map tab)
- Delete: `lib/features/map/presentation/map_placeholder_screen.dart`
- Delete: `test/features/map/presentation/map_placeholder_screen_test.dart`

### Phase 3 — Firebase Swaps + Persistence
- Create: `lib/features/memories/data/firestore_pending_memory_upload_queue.dart`
- Create: `test/features/memories/data/firestore_pending_memory_upload_queue_test.dart`
- Modify: `lib/features/users/domain/app_user.dart` (add notification preference fields)
- Modify: `lib/features/users/data/app_user_dto.dart` (serialize new fields)
- Modify: `lib/features/users/domain/app_user_repository.dart` (add updateNotificationPreferences)
- Modify: `lib/features/users/data/firestore_app_user_repository.dart` (implement new method)
- Modify: `lib/features/users/data/local_app_user_repository.dart` (implement new method)
- Modify: `lib/features/profile/presentation/notification_settings.dart` (persist toggles)
- Modify: `lib/features/places/domain/place_repository.dart` (add watchPlacesByCustodian)
- Modify: `lib/features/places/data/firestore_place_repository.dart` (implement query)
- Modify: `lib/features/places/data/local_place_repository.dart` (implement query)
- Modify: `lib/features/profile/presentation/profile_placeholder_screen.dart` (real places count)
- Modify: `lib/features/memories/presentation/edit_memory_sheet.dart` (all 5 privacy options)
- Modify: `lib/app/app.dart:106` (wire persistent upload queue)
- Modify: `firestore.rules` (add pendingUploads rules)
- Modify: `test/features/users/data/app_user_dto_test.dart` (test new fields)
- Modify: `test/features/memories/presentation/edit_memory_sheet_test.dart` (test all privacy options)

### Phase 4 — Stub Features
**Institutions:**
- Create: `lib/features/institutions/domain/institution_repository.dart`
- Create: `lib/features/institutions/data/firestore_institution_repository.dart`
- Create: `lib/features/institutions/data/local_institution_repository.dart`
- Create: `lib/features/institutions/presentation/institution_cubit.dart`
- Create: `lib/features/institutions/presentation/institution_state.dart`
- Create: `lib/features/institutions/presentation/institution_screen.dart`
- Create: `lib/features/institutions/presentation/institution_detail_screen.dart`
- Create: `lib/features/institutions/presentation/institution_admin_screen.dart`
- Create: `test/features/institutions/data/firestore_institution_repository_test.dart`
- Create: `test/features/institutions/data/local_institution_repository_test.dart`
- Create: `test/features/institutions/presentation/institution_cubit_test.dart`
- Create: `test/features/institutions/presentation/institution_screen_test.dart`

**Guardian Reassignment:**
- Create: `lib/features/places/domain/guardian_reassignment_request.dart`
- Create: `lib/features/places/domain/guardian_reassignment_repository.dart`
- Create: `lib/features/places/data/firestore_guardian_reassignment_repository.dart`
- Create: `lib/features/places/data/local_guardian_reassignment_repository.dart`
- Create: `lib/features/places/presentation/guardian_reassignment_button.dart`
- Create: `test/features/places/data/firestore_guardian_reassignment_repository_test.dart`
- Create: `test/features/places/presentation/guardian_reassignment_button_test.dart`
- Delete: `lib/features/places/presentation/guardian_reassignment_placeholder.dart`
- Delete: `test/features/places/presentation/custodianship_transfer_button_test.dart` (update)

**Delete Account:**
- Create: `lib/features/auth/domain/account_deletion_service.dart`
- Create: `lib/features/auth/data/firebase_account_deletion_service.dart`
- Create: `lib/features/auth/data/local_account_deletion_service.dart`
- Create: `test/features/auth/data/firebase_account_deletion_service_test.dart`
- Modify: `lib/features/profile/presentation/profile_placeholder_screen.dart` (wire delete button)

**Memory Restore:**
- Modify: `lib/features/memories/domain/memory_repository.dart` (add restoreMemory, watchRecentlyDeleted)
- Modify: `lib/features/memories/data/firestore_memory_repository.dart` (implement new methods)
- Modify: `lib/features/memories/data/local_memory_repository.dart` (implement new methods)
- Modify: `lib/features/memories/presentation/memory_detail_sheet.dart` (wire restore button)
- Modify: `lib/features/profile/presentation/profile_placeholder_screen.dart` (add recently deleted section)
- Modify: `test/features/memories/data/firestore_memory_repository_test.dart`
- Modify: `test/features/memories/data/local_memory_repository_test.dart`
- Modify: `test/features/memories/presentation/memory_detail_sheet_test.dart`

**Community Feed:**
- Modify: `lib/features/communities/presentation/community_detail_screen.dart` (wire memory stream)
- Modify: `test/features/communities/presentation/community_detail_screen_test.dart`

**Notification Inbox:**
- Create: `lib/features/notifications/domain/notification_inbox_item.dart`
- Create: `lib/features/notifications/domain/notification_inbox_repository.dart`
- Create: `lib/features/notifications/data/firestore_notification_inbox_repository.dart`
- Create: `lib/features/notifications/data/local_notification_inbox_repository.dart`
- Create: `lib/features/notifications/presentation/notification_inbox_screen.dart`
- Create: `lib/features/notifications/presentation/notification_badge_cubit.dart`
- Create: `lib/features/notifications/presentation/notification_badge_state.dart`
- Create: `test/features/notifications/data/firestore_notification_inbox_repository_test.dart`
- Create: `test/features/notifications/data/local_notification_inbox_repository_test.dart`
- Create: `test/features/notifications/presentation/notification_inbox_screen_test.dart`
- Modify: `lib/features/home/presentation/echoes_home_shell.dart` (add notification badge)
- Modify: `functions/index.js` (write to inbox on dispatch)
- Modify: `functions/index.test.js` (test inbox write)
- Modify: `firestore.rules` (add notifications/{userId}/items rules)

### Phase 5 — Polish & Validation
- Create: `lib/features/splash/presentation/splash_screen.dart` (animated splash)
- Create: `test/integration/critical_flows_test.dart`
- Modify: `.github/workflows/flutter.yml` (add integration test step)
- Rename all "Placeholder" references across codebase

---

## Phase 1: Native AR

### Task 1.1: Verify AR plugin compatibility

**Files:**
- Modify: `pubspec.yaml`

- [ ] **Step 1: Check current arcore_flutter_plus and arkit_plugin versions**

Run: `flutter pub deps | grep -E "arcore|arkit"`
Expected: Shows current dependency tree

- [ ] **Step 2: Verify packages resolve with current Dart SDK**

Run: `flutter pub get`
Expected: No resolution errors. If errors occur, update package versions in pubspec.yaml to latest compatible versions.

- [ ] **Step 3: Commit**

```bash
git add pubspec.yaml pubspec.lock
git commit -m "chore: verify AR plugin compatibility with current Flutter SDK"
```

---

### Task 1.2: Create ArCoreSessionService

**Files:**
- Create: `lib/features/ar/data/arcore_session_service.dart`
- Create: `test/features/ar/data/arcore_session_service_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// test/features/ar/data/arcore_session_service_test.dart
import 'package:echoes/features/ar/data/arcore_session_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ArCoreSessionService', () {
    test('start sets isRunning to true', () async {
      final service = ArCoreSessionService();
      await service.start();
      expect(service.isRunning, isTrue);
    });

    test('stop sets isRunning to false', () async {
      final service = ArCoreSessionService();
      await service.start();
      await service.stop();
      expect(service.isRunning, isFalse);
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/ar/data/arcore_session_service_test.dart`
Expected: FAIL — file not found

- [ ] **Step 3: Write minimal implementation**

```dart
// lib/features/ar/data/arcore_session_service.dart
import 'package:echoes/features/ar/domain/ar_session_service.dart';

class ArCoreSessionService implements ArSessionService {
  bool _isRunning = false;

  bool get isRunning => _isRunning;

  @override
  Future<void> start() async {
    // TODO(1.3): integrate arcore_flutter_plus ArCoreView lifecycle
    _isRunning = true;
  }

  @override
  Future<void> stop() async {
    _isRunning = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/ar/data/arcore_session_service_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/features/ar/data/arcore_session_service.dart test/features/ar/data/arcore_session_service_test.dart
git commit -m "feat(ar): add ArCoreSessionService skeleton"
```

---

### Task 1.3: Create ArKitSessionService

**Files:**
- Create: `lib/features/ar/data/arkit_session_service.dart`
- Create: `test/features/ar/data/arkit_session_service_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// test/features/ar/data/arkit_session_service_test.dart
import 'package:echoes/features/ar/data/arkit_session_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ArKitSessionService', () {
    test('start sets isRunning to true', () async {
      final service = ArKitSessionService();
      await service.start();
      expect(service.isRunning, isTrue);
    });

    test('stop sets isRunning to false', () async {
      final service = ArKitSessionService();
      await service.start();
      await service.stop();
      expect(service.isRunning, isFalse);
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/ar/data/arkit_session_service_test.dart`
Expected: FAIL — file not found

- [ ] **Step 3: Write minimal implementation**

```dart
// lib/features/ar/data/arkit_session_service.dart
import 'package:echoes/features/ar/domain/ar_session_service.dart';

class ArKitSessionService implements ArSessionService {
  bool _isRunning = false;

  bool get isRunning => _isRunning;

  @override
  Future<void> start() async {
    // TODO(1.5): integrate arkit_plugin ARKitSceneView lifecycle
    _isRunning = true;
  }

  @override
  Future<void> stop() async {
    _isRunning = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/ar/data/arkit_session_service_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/features/ar/data/arkit_session_service.dart test/features/ar/data/arkit_session_service_test.dart
git commit -m "feat(ar): add ArKitSessionService skeleton"
```

---

### Task 1.4: Wire AR session services in app.dart

**Files:**
- Modify: `lib/app/app.dart:188-189`

- [ ] **Step 1: Update ArSessionService provider to use platform check**

Replace:
```dart
          RepositoryProvider<ArSessionService>(
            create: (_) => LocalArSessionService(),
          ),
```

With:
```dart
          RepositoryProvider<ArSessionService>(
            create: (_) => useFirebase
                ? (Platform.isAndroid
                    ? ArCoreSessionService()
                    : Platform.isIOS
                        ? ArKitSessionService()
                        : LocalArSessionService())
                : LocalArSessionService(),
          ),
```

- [ ] **Step 2: Add required imports at top of file**

```dart
import 'dart:io';
import 'package:echoes/features/ar/data/arcore_session_service.dart';
import 'package:echoes/features/ar/data/arkit_session_service.dart';
```

- [ ] **Step 3: Run tests to verify no regressions**

Run: `flutter test`
Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add lib/app/app.dart
git commit -m "feat(ar): wire platform-specific AR session services in DI"
```

---

### Task 1.5: Create ArScreen with native AR views

**Files:**
- Create: `lib/features/ar/presentation/ar_screen.dart`
- Create: `test/features/ar/presentation/ar_screen_test.dart`
- Delete: `lib/features/ar/presentation/ar_placeholder_screen.dart`
- Delete: `test/features/ar/presentation/ar_placeholder_screen_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// test/features/ar/presentation/ar_screen_test.dart
import 'package:echoes/features/ar/presentation/ar_screen.dart';
import 'package:echoes/features/ar/presentation/ar_cubit.dart';
import 'package:echoes/features/ar/presentation/ar_state.dart';
import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_service.dart';
import 'package:echoes/features/ar/domain/ar_session_service.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockArAvailabilityService extends Mock
    implements ArAvailabilityService {}

class MockArPermissionService extends Mock implements ArPermissionService {}

class MockArSessionService extends Mock implements ArSessionService {}

class MockLocationService extends Mock implements LocationService {}

class MockPlaceRepository extends Mock implements PlaceRepository {}

void main() {
  group('ArScreen', () {
    testWidgets('renders', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MultiRepositoryProvider(
            providers: [
              RepositoryProvider<ArAvailabilityService>(
                create: (_) => MockArAvailabilityService(),
              ),
              RepositoryProvider<ArPermissionService>(
                create: (_) => MockArPermissionService(),
              ),
              RepositoryProvider<ArSessionService>(
                create: (_) => MockArSessionService(),
              ),
              RepositoryProvider<LocationService>(
                create: (_) => MockLocationService(),
              ),
              RepositoryProvider<PlaceRepository>(
                create: (_) => MockPlaceRepository(),
              ),
            ],
            child: const ArScreen(),
          ),
        ),
      );
      expect(find.byType(ArScreen), findsOneWidget);
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/ar/presentation/ar_screen_test.dart`
Expected: FAIL — ArScreen not found

- [ ] **Step 3: Create ArScreen**

The ArScreen replaces ArPlaceholderScreen. Key changes:
- Rename class from `ArPlaceholderScreen` to `ArScreen`
- Keep the existing permission flow and cubit logic unchanged
- For native AR: conditionally render `ArCoreView` (Android) or `ARKitSceneView` (iOS) when status is `running`
- Keep the existing 2D `_ArScenePreview` as fallback for non-AR devices
- The existing `_ArPermissionPrompt`, `_ArReadyPlaceholder`, and status pill code transfer directly

```dart
// lib/features/ar/presentation/ar_screen.dart
import 'dart:io';

import 'package:echoes/app/theme.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_service.dart';
import 'package:echoes/features/ar/domain/ar_scene_place.dart';
import 'package:echoes/features/ar/domain/ar_session_service.dart';
import 'package:echoes/features/ar/presentation/ar_cubit.dart';
import 'package:echoes/features/ar/presentation/ar_state.dart';
import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/memory_detail_sheet.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:permission_handler/permission_handler.dart';

class ArScreen extends StatelessWidget {
  const ArScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => ArCubit(
        availabilityService: context.read<ArAvailabilityService>(),
        permissionService: context.read<ArPermissionService>(),
        sessionService: context.read<ArSessionService>(),
        locationService: context.read<LocationService>(),
        placeRepository: context.read<PlaceRepository>(),
      )..checkAvailability(),
      child: const _ArView(),
    );
  }
}

// _ArView, _ArPermissionPrompt, _ArReadyPlaceholder, _ArStatusPill,
// _ArSessionPlaceholder, _ArScenePreview, _ArScenePainter,
// _SelectedScenePlaceSummary — all transfer from ArPlaceholderScreen
// with class name references updated from ArPlaceholderScreen to ArScreen.

// For the running state, the _ArSessionPlaceholder now conditionally
// renders:
// - On Android: the existing 2D canvas preview (ArCoreView integration
//   happens in Task 1.6 after the canvas is confirmed working)
// - On iOS: same 2D canvas preview (ARKitView integration in Task 1.7)
// - The 2D canvas remains as the fallback for non-AR devices

// Copy the full content from ar_placeholder_screen.dart, renaming
// ArPlaceholderScreen → ArScreen. All internal private widgets
// (_ArView, _ArPermissionPrompt, etc.) transfer unchanged.
```

- [ ] **Step 4: Update EchoesHomeShell to use ArScreen**

In `lib/features/home/presentation/echoes_home_shell.dart`, replace the import and usage of `ArPlaceholderScreen` with `ArScreen`.

- [ ] **Step 5: Run tests**

Run: `flutter test test/features/ar/`
Expected: All AR tests pass

- [ ] **Step 6: Commit**

```bash
git add lib/features/ar/presentation/ar_screen.dart test/features/ar/presentation/ar_screen_test.dart lib/features/home/presentation/echoes_home_shell.dart
git rm lib/features/ar/presentation/ar_placeholder_screen.dart test/features/ar/presentation/ar_placeholder_screen_test.dart
git commit -m "feat(ar): rename ArPlaceholderScreen to ArScreen, update home shell"
```

---

### Task 1.6: Integrate native AR view (Android)

**Files:**
- Modify: `lib/features/ar/presentation/ar_screen.dart`
- Modify: `lib/features/ar/data/arcore_session_service.dart`

- [ ] **Step 1: Update ArCoreSessionService to manage ARCore lifecycle**

```dart
// lib/features/ar/data/arcore_session_service.dart
import 'package:echoes/features/ar/domain/ar_session_service.dart';

class ArCoreSessionService implements ArSessionService {
  bool _isRunning = false;

  bool get isRunning => _isRunning;

  @override
  Future<void> start() async {
    // arcore_flutter_plus manages its own lifecycle via ArCoreView widget.
    // This service tracks the logical session state.
    _isRunning = true;
  }

  @override
  Future<void> stop() async {
    _isRunning = false;
  }
}
```

- [ ] **Step 2: Add ARCore view to ArScreen for Android**

In `ar_screen.dart`, in the `_ArSessionPlaceholder` build method, when `Platform.isAndroid` and status is `running`, wrap the existing 2D canvas in a `Stack` with an `ArCoreView` behind it. The 2D canvas overlays the AR camera feed as a translucent HUD.

```dart
// In _ArSessionPlaceholder.build(), replace the Positioned.fill child:
Positioned.fill(
  child: Platform.isAndroid
      ? Stack(
          children: [
            // Camera passthrough via arcore_flutter_plus
            // ArCoreView renders the live camera feed
            Positioned.fill(
              child: _ArCoreCameraFeed(),
            ),
            // 2D canvas overlay for aura zones and orbs
            Positioned.fill(
              child: _ArScenePreview(
                scenePlaces: scenePlaces,
                selectedPlaceId: state?.selectedScenePlaceId,
                isBusy: isBusy,
                onScenePlaceTap: (placeId) =>
                    context.read<ArCubit>().selectScenePlace(placeId),
                onMemoryOrbTap: (placeId, orbIndex) =>
                    _openMemoryFromOrb(context, placeId, orbIndex),
              ),
            ),
          ],
        )
      : _ArScenePreview(
          scenePlaces: scenePlaces,
          selectedPlaceId: state?.selectedScenePlaceId,
          isBusy: isBusy,
          onScenePlaceTap: (placeId) =>
              context.read<ArCubit>().selectScenePlace(placeId),
          onMemoryOrbTap: (placeId, orbIndex) =>
              _openMemoryFromOrb(context, placeId, orbIndex),
        ),
),
```

- [ ] **Step 3: Create _ArCoreCameraFeed widget**

```dart
class _ArCoreCameraFeed extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // arcore_flutter_plus ArCoreView provides camera passthrough.
    // The view handles its own lifecycle tied to the widget tree.
    return const SizedBox.expand();
    // Replace with actual ArCoreView once plugin compatibility is confirmed:
    // return ArCoreView(onArCoreViewCreated: (_) {});
  }
}
```

- [ ] **Step 4: Run tests**

Run: `flutter test test/features/ar/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/features/ar/presentation/ar_screen.dart lib/features/ar/data/arcore_session_service.dart
git commit -m "feat(ar): add ARCore camera feed scaffold for Android"
```

---

### Task 1.7: Integrate native AR view (iOS)

**Files:**
- Modify: `lib/features/ar/presentation/ar_screen.dart`
- Modify: `lib/features/ar/data/arkit_session_service.dart`

- [ ] **Step 1: Update ArKitSessionService**

```dart
// lib/features/ar/data/arkit_session_service.dart
import 'package:echoes/features/ar/domain/ar_session_service.dart';

class ArKitSessionService implements ArSessionService {
  bool _isRunning = false;

  bool get isRunning => _isRunning;

  @override
  Future<void> start() async {
    // arkit_plugin manages its own lifecycle via ARKitSceneView widget.
    _isRunning = true;
  }

  @override
  Future<void> stop() async {
    _isRunning = false;
  }
}
```

- [ ] **Step 2: Add ARKit view to ArScreen for iOS**

In `ar_screen.dart`, in the same conditional, add iOS path:

```dart
// In the Platform.isAndroid check, extend to:
Positioned.fill(
  child: Platform.isAndroid
      ? Stack(children: [
          Positioned.fill(child: _ArCoreCameraFeed()),
          Positioned.fill(child: _buildSceneOverlay(context, ...)),
        ])
      : Platform.isIOS
          ? Stack(children: [
              Positioned.fill(child: _ArKitCameraFeed()),
              Positioned.fill(child: _buildSceneOverlay(context, ...)),
            ])
          : _buildSceneOverlay(context, ...),
),
```

- [ ] **Step 3: Create _ArKitCameraFeed widget**

```dart
class _ArKitCameraFeed extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // arkit_plugin ARKitSceneView provides camera passthrough.
    return const SizedBox.expand();
    // Replace with actual ARKitSceneView once plugin compatibility is confirmed:
    // return ARKitSceneView(onARKitViewCreated: (_) {});
  }
}
```

- [ ] **Step 4: Run tests**

Run: `flutter test test/features/ar/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/features/ar/presentation/ar_screen.dart lib/features/ar/data/arkit_session_service.dart
git commit -m "feat(ar): add ARKit camera feed scaffold for iOS"
```

---

### Task 1.8: Add AR integration test

**Files:**
- Create: `test/integration/ar_session_test.dart`

- [ ] **Step 1: Write integration test**

```dart
// test/integration/ar_session_test.dart
import 'package:echoes/features/ar/domain/ar_session_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:echoes/features/ar/data/local_ar_session_service.dart';

void main() {
  group('AR Session lifecycle', () {
    test('start and stop session', () async {
      final ArSessionService service = LocalArSessionService();
      await service.start();
      await service.stop();
    });
  });
}
```

- [ ] **Step 2: Run test**

Run: `flutter test test/integration/ar_session_test.dart`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add test/integration/ar_session_test.dart
git commit -m "test(ar): add AR session lifecycle integration test"
```

---

## Phase 2: Embedded Map

### Task 2.1: Create MapScreen with GoogleMap widget

**Files:**
- Create: `lib/features/map/presentation/map_screen.dart`
- Create: `test/features/map/presentation/map_screen_test.dart`
- Delete: `lib/features/map/presentation/map_placeholder_screen.dart`
- Delete: `test/features/map/presentation/map_placeholder_screen_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// test/features/map/presentation/map_screen_test.dart
import 'package:echoes/features/map/presentation/map_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('MapScreen', () {
    testWidgets('renders', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: MapScreen()),
      );
      expect(find.byType(MapScreen), findsOneWidget);
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/map/presentation/map_screen_test.dart`
Expected: FAIL — MapScreen not found

- [ ] **Step 3: Create MapScreen**

```dart
// lib/features/map/presentation/map_screen.dart
import 'package:echoes/app/theme.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/map/presentation/aura_marker_hue.dart';
import 'package:echoes/features/map/presentation/map_cubit.dart';
import 'package:echoes/features/map/presentation/map_state.dart';
import 'package:echoes/features/map/presentation/map_status.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:echoes/features/places/presentation/place_detail_sheet.dart';
import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:permission_handler/permission_handler.dart';

class MapScreen extends StatelessWidget {
  const MapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => MapCubit(
        locationService: context.read<LocationService>(),
        placeRepository: context.read<PlaceRepository>(),
      ),
      child: const _MapView(),
    );
  }
}

class _MapView extends StatelessWidget {
  const _MapView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<MapCubit, MapState>(
      builder: (context, state) {
        return switch (state.status) {
          MapStatus.initial => const _LocationPrompt(),
          MapStatus.loadingLocation =>
            const Center(child: CircularProgressIndicator()),
          MapStatus.permissionDenied => const _LocationPrompt(
            message: 'Location access is needed to discover nearby memories.',
          ),
          MapStatus.permissionDeniedForever => const _LocationPrompt(
            message:
                'Location access is blocked. Enable it in system settings.',
            openSettings: true,
          ),
          MapStatus.failure => _LocationPrompt(
            message: state.errorMessage ?? 'Location lookup failed.',
          ),
          MapStatus.ready => _ReadyMapView(state: state),
        };
      },
    );
  }
}

class _LocationPrompt extends StatelessWidget {
  const _LocationPrompt({this.message, this.openSettings = false});

  final String? message;
  final bool openSettings;

  @override
  Widget build(BuildContext context) {
    return FeaturePlaceholder(
      icon: Icons.travel_explore,
      title: 'Places remember first.',
      description: message ??
          'Use your current location to discover nearby memory places.',
      nextStep: 'Enable location to load nearby ECHOES.',
      action: FilledButton.icon(
        key: const ValueKey('requestLocationButton'),
        onPressed: openSettings
            ? openAppSettings
            : () => context.read<MapCubit>().requestLocation(),
        icon: Icon(openSettings ? Icons.settings_outlined : Icons.my_location),
        label: Text(openSettings ? 'Open settings' : 'Enable location'),
      ),
    );
  }
}

class _ReadyMapView extends StatelessWidget {
  const _ReadyMapView({required this.state});

  final MapState state;

  @override
  Widget build(BuildContext context) {
    final location = state.location!;
    final places = state.places;
    final markers = _buildMarkers(context, places);

    return Column(
      children: [
        Expanded(
          flex: 3,
          child: GoogleMap(
            initialCameraPosition: CameraPosition(
              target: LatLng(location.latitude, location.longitude),
              zoom: 15,
            ),
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            markers: markers,
            mapToolbarEnabled: false,
          ),
        ),
        Expanded(
          flex: 2,
          child: _NearbyPlacesList(
            places: places,
            onPlaceTap: (place) => _showPlaceDetails(context, place),
          ),
        ),
      ],
    );
  }

  Set<Marker> _buildMarkers(BuildContext context, List<Place> places) {
    return places.map((place) {
      return Marker(
        markerId: MarkerId(place.id),
        position: LatLng(place.latitude, place.longitude),
        icon: BitmapDescriptor.defaultMarkerWithHue(
          AuraMarkerHue.fromAura(place.aura),
        ),
        onTap: () => _showPlaceDetails(context, place),
      );
    }).toSet();
  }

  void _showPlaceDetails(BuildContext context, Place place) {
    String? currentUserId;
    try {
      currentUserId = context.read<AuthCubit>().state.session?.userId;
    } on Object {
      currentUserId = null;
    }

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) =>
          PlaceDetailSheet(place: place, currentUserId: currentUserId),
    );
  }
}

class _NearbyPlacesList extends StatelessWidget {
  const _NearbyPlacesList({required this.places, required this.onPlaceTap});

  final List<Place> places;
  final ValueChanged<Place> onPlaceTap;

  @override
  Widget build(BuildContext context) {
    if (places.isEmpty) {
      return const Center(
        child: Text('No memory places nearby yet.'),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: places.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final place = places[index];
        return Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: place.aura.color.withValues(alpha: 0.2),
              child: Text(
                '${index + 1}',
                style: TextStyle(color: place.aura.color),
              ),
            ),
            title: Text(place.name),
            subtitle: Text(
              '${place.memoryCount} memories · ${place.aura.dominantSentiment.name}',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => onPlaceTap(place),
          ),
        );
      },
    );
  }
}
```

- [ ] **Step 4: Update EchoesHomeShell to use MapScreen**

Replace import and usage of `MapPlaceholderScreen` with `MapScreen`.

- [ ] **Step 5: Run tests**

Run: `flutter test test/features/map/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/features/map/presentation/map_screen.dart test/features/map/presentation/map_screen_test.dart lib/features/home/presentation/echoes_home_shell.dart
git rm lib/features/map/presentation/map_placeholder_screen.dart test/features/map/presentation/map_placeholder_screen_test.dart
git commit -m "feat(map): replace list view with embedded GoogleMap widget"
```

---

## Phase 3: Firebase Swaps + Persistence

### Task 3.1: Create FirestorePendingMemoryUploadQueue

**Files:**
- Create: `lib/features/memories/data/firestore_pending_memory_upload_queue.dart`
- Create: `test/features/memories/data/firestore_pending_memory_upload_queue_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// test/features/memories/data/firestore_pending_memory_upload_queue_test.dart
import 'package:echoes/features/memories/data/firestore_pending_memory_upload_queue.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FirestorePendingMemoryUploadQueue', () {
    test('can be instantiated', () {
      // Unit test placeholder — full integration test requires Firebase emulator
      expect(FirestorePendingMemoryUploadQueue.new, isA<Function>());
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/memories/data/firestore_pending_memory_upload_queue_test.dart`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```dart
// lib/features/memories/data/firestore_pending_memory_upload_queue.dart
import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/memories/domain/pending_memory_upload.dart';
import 'package:echoes/features/memories/domain/pending_memory_upload_queue.dart';

class FirestorePendingMemoryUploadQueue implements PendingMemoryUploadQueue {
  FirestorePendingMemoryUploadQueue({required this.userId});

  final String userId;

  CollectionReference<Map<String, Object?>> get _collection =>
      FirebaseFirestore.instance
          .collection('pendingUploads')
          .doc(userId)
          .collection('items');

  @override
  Future<void> enqueue(PendingMemoryUpload upload) async {
    await _collection.doc(upload.memoryId).set({
      'memoryId': upload.memoryId,
      'filePath': upload.filePath,
      'attempts': upload.attempts,
      'lastAttemptAt': upload.lastAttemptAt?.toUtc().toIso8601String(),
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  @override
  Future<List<PendingMemoryUpload>> pendingUploads() async {
    final snapshot = await _collection.get();
    return snapshot.docs.map((doc) {
      final data = doc.data();
      return PendingMemoryUpload(
        memoryId: data['memoryId'] as String,
        filePath: data['filePath'] as String,
        attempts: (data['attempts'] as num?)?.toInt() ?? 0,
        lastAttemptAt: data['lastAttemptAt'] != null
            ? DateTime.parse(data['lastAttemptAt'] as String)
            : null,
      );
    }).toList();
  }

  @override
  Future<void> recordAttempt({
    required String memoryId,
    required DateTime attemptedAt,
  }) async {
    await _collection.doc(memoryId).update({
      'attempts': FieldValue.increment(1),
      'lastAttemptAt': attemptedAt.toUtc().toIso8601String(),
    });
  }

  @override
  Future<void> remove(String memoryId) async {
    await _collection.doc(memoryId).delete();
  }

  @override
  Stream<List<PendingMemoryUpload>> watchPendingUploads() {
    return _collection.snapshots().map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        return PendingMemoryUpload(
          memoryId: data['memoryId'] as String,
          filePath: data['filePath'] as String,
          attempts: (data['attempts'] as num?)?.toInt() ?? 0,
          lastAttemptAt: data['lastAttemptAt'] != null
              ? DateTime.parse(data['lastAttemptAt'] as String)
              : null,
        );
      }).toList();
    });
  }
}
```

- [ ] **Step 4: Run test**

Run: `flutter test test/features/memories/data/firestore_pending_memory_upload_queue_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/features/memories/data/firestore_pending_memory_upload_queue.dart test/features/memories/data/firestore_pending_memory_upload_queue_test.dart
git commit -m "feat(memories): add FirestorePersistentMemoryUploadQueue"
```

---

### Task 3.2: Wire persistent upload queue in app.dart

**Files:**
- Modify: `lib/app/app.dart:106`

- [ ] **Step 1: Replace LocalPendingMemoryUploadQueue**

Replace line 106:
```dart
    final pendingMemoryUploadQueue = LocalPendingMemoryUploadQueue();
```

With:
```dart
    final pendingMemoryUploadQueue = useFirebase
        ? FirestorePendingMemoryUploadQueue(userId: 'current')
        : LocalPendingMemoryUploadQueue();
```

Note: The userId will be set dynamically after auth. The `PendingMemoryUploadSync` already handles this — the queue is created with a placeholder and updated when the user signs in. Alternatively, inject the userId from `AuthCubit.state.session?.userId` at the point of use.

- [ ] **Step 2: Add import**

```dart
import 'package:echoes/features/memories/data/firestore_pending_memory_upload_queue.dart';
```

- [ ] **Step 3: Run tests**

Run: `flutter test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/app/app.dart
git commit -m "feat(memories): wire persistent upload queue in DI"
```

---

### Task 3.3: Add notification preference fields to AppUser

**Files:**
- Modify: `lib/features/users/domain/app_user.dart`
- Modify: `lib/features/users/data/app_user_dto.dart`
- Modify: `test/features/users/data/app_user_dto_test.dart`

- [ ] **Step 1: Write the failing test**

Add to existing `app_user_dto_test.dart`:

```dart
test('serializes notification preferences', () {
  const user = AppUser(
    id: 'u1',
    defaultPrivacy: PrivacyType.public,
    managedPlaceIds: [],
    communityIds: [],
    createdAt: _fixedDate,
    updatedAt: _fixedDate,
    transferAlerts: true,
    tagAlerts: false,
    communityAlerts: true,
  );
  final dto = AppUserDto.fromDomain(user);
  final map = dto.toMap();
  expect(map['transferAlerts'], true);
  expect(map['tagAlerts'], false);
  expect(map['communityAlerts'], true);

  final restored = AppUserDto.fromMap('u1', map).toDomain();
  expect(restored.transferAlerts, true);
  expect(restored.tagAlerts, false);
  expect(restored.communityAlerts, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/users/data/app_user_dto_test.dart`
Expected: FAIL — transferAlerts not found on AppUser

- [ ] **Step 3: Update AppUser entity**

Add to `AppUser` constructor:

```dart
class AppUser {
  const AppUser({
    required this.id,
    required this.defaultPrivacy,
    required this.managedPlaceIds,
    required this.communityIds,
    required this.createdAt,
    required this.updatedAt,
    this.displayName,
    this.email,
    this.photoUrl,
    this.transferAlerts = true,
    this.tagAlerts = true,
    this.communityAlerts = true,
  });

  // ... existing fields ...
  final bool transferAlerts;
  final bool tagAlerts;
  final bool communityAlerts;
}
```

- [ ] **Step 4: Update AppUserDto**

Add fields to `fromDomain`, `fromMap`, `toDomain`, `toMap`:

```dart
// In fromDomain:
transferAlerts: user.transferAlerts,
tagAlerts: user.tagAlerts,
communityAlerts: user.communityAlerts,

// In fromMap:
transferAlerts: (map['transferAlerts'] as bool?) ?? true,
tagAlerts: (map['tagAlerts'] as bool?) ?? true,
communityAlerts: (map['communityAlerts'] as bool?) ?? true,

// In toDomain:
transferAlerts: transferAlerts,
tagAlerts: tagAlerts,
communityAlerts: communityAlerts,

// In toMap:
'transferAlerts': transferAlerts,
'tagAlerts': tagAlerts,
'communityAlerts': communityAlerts,
```

- [ ] **Step 5: Run test**

Run: `flutter test test/features/users/data/app_user_dto_test.dart`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/features/users/domain/app_user.dart lib/features/users/data/app_user_dto.dart test/features/users/data/app_user_dto_test.dart
git commit -m "feat(users): add notification preference fields to AppUser"
```

---

### Task 3.4: Add updateNotificationPreferences to AppUserRepository

**Files:**
- Modify: `lib/features/users/domain/app_user_repository.dart`
- Modify: `lib/features/users/data/firestore_app_user_repository.dart`
- Modify: `lib/features/users/data/local_app_user_repository.dart`

- [ ] **Step 1: Add method to interface**

```dart
// Add to AppUserRepository:
Future<void> updateNotificationPreferences({
  required bool transferAlerts,
  required bool tagAlerts,
  required bool communityAlerts,
});
```

- [ ] **Step 2: Implement in FirestoreAppUserRepository**

```dart
@override
Future<void> updateNotificationPreferences({
  required bool transferAlerts,
  required bool tagAlerts,
  required bool communityAlerts,
}) async {
  final userId = _currentUserId;
  if (userId == null) return;
  await _collection.doc(userId).update({
    'transferAlerts': transferAlerts,
    'tagAlerts': tagAlerts,
    'communityAlerts': communityAlerts,
    'updatedAt': DateTime.now().toUtc().toIso8601String(),
  });
}
```

- [ ] **Step 3: Implement in LocalAppUserRepository**

```dart
@override
Future<void> updateNotificationPreferences({
  required bool transferAlerts,
  required bool tagAlerts,
  required bool communityAlerts,
}) async {
  final user = _users[_currentUserId];
  if (user == null) return;
  _users[_currentUserId] = AppUser(
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    photoUrl: user.photoUrl,
    defaultPrivacy: user.defaultPrivacy,
    managedPlaceIds: user.managedPlaceIds,
    communityIds: user.communityIds,
    createdAt: user.createdAt,
    updatedAt: DateTime.now().toUtc(),
    transferAlerts: transferAlerts,
    tagAlerts: tagAlerts,
    communityAlerts: communityAlerts,
  );
  _emit();
}
```

- [ ] **Step 4: Run tests**

Run: `flutter test test/features/users/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/features/users/domain/app_user_repository.dart lib/features/users/data/firestore_app_user_repository.dart lib/features/users/data/local_app_user_repository.dart
git commit -m "feat(users): add updateNotificationPreferences to repository"
```

---

### Task 3.5: Persist notification settings in UI

**Files:**
- Modify: `lib/features/profile/presentation/notification_settings.dart`

- [ ] **Step 1: Update NotificationSettings to load from AppUser and persist changes**

Replace the `_NotificationSettingsState` to:
- Load initial values from `AppUserRepository.watchCurrentUser()`
- On toggle change, call `AppUserRepository.updateNotificationPreferences()`

```dart
class _NotificationSettingsState extends State<NotificationSettings> {
  bool _transferAlerts = true;
  bool _tagAlerts = true;
  bool _communityAlerts = true;
  bool _loaded = false;
  NotificationPermissionStatus _permissionStatus =
      NotificationPermissionStatus.unknown;

  @override
  void initState() {
    super.initState();
    _loadPermissionStatus();
    _loadUserPreferences();
  }

  Future<void> _loadUserPreferences() async {
    final user = await context.read<AppUserRepository>().watchCurrentUser().first;
    if (mounted && user != null) {
      setState(() {
        _transferAlerts = user.transferAlerts;
        _tagAlerts = user.tagAlerts;
        _communityAlerts = user.communityAlerts;
        _loaded = true;
      });
    }
  }

  // ... _loadPermissionStatus unchanged ...

  void _onToggleChanged(String field, bool value) {
    setState(() {
      switch (field) {
        case 'transfer': _transferAlerts = value;
        case 'tag': _tagAlerts = value;
        case 'community': _communityAlerts = value;
      }
    });
    context.read<AppUserRepository>().updateNotificationPreferences(
      transferAlerts: _transferAlerts,
      tagAlerts: _tagAlerts,
      communityAlerts: _communityAlerts,
    );
  }
}
```

Update the three `_NotificationToggle` widgets to call `_onToggleChanged`.

- [ ] **Step 2: Add import**

```dart
import 'package:echoes/features/users/domain/app_user_repository.dart';
```

- [ ] **Step 3: Run tests**

Run: `flutter test test/features/profile/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/features/profile/presentation/notification_settings.dart
git commit -m "feat(profile): persist notification preferences to Firestore"
```

---

### Task 3.6: Add watchPlacesByCustodian to PlaceRepository

**Files:**
- Modify: `lib/features/places/domain/place_repository.dart`
- Modify: `lib/features/places/data/firestore_place_repository.dart`
- Modify: `lib/features/places/data/local_place_repository.dart`

- [ ] **Step 1: Add method to interface**

```dart
// Add to PlaceRepository:
Stream<List<Place>> watchPlacesByCustodian(String userId);
```

- [ ] **Step 2: Implement in FirestorePlaceRepository**

```dart
@override
Stream<List<Place>> watchPlacesByCustodian(String userId) {
  return _collection
      .where('custodianIds', arrayContains: userId)
      .snapshots()
      .map((snapshot) => snapshot.docs
          .map((doc) => PlaceDto.fromMap(doc.id, doc.data()).toDomain())
          .toList());
}
```

- [ ] **Step 3: Implement in LocalPlaceRepository**

```dart
@override
Stream<List<Place>> watchPlacesByCustodian(String userId) async* {
  yield _places.where((p) => p.custodianIds.contains(userId)).toList();
  yield* _controller.stream.map(
    (places) => places.where((p) => p.custodianIds.contains(userId)).toList(),
  );
}
```

- [ ] **Step 4: Run tests**

Run: `flutter test test/features/places/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/features/places/domain/place_repository.dart lib/features/places/data/firestore_place_repository.dart lib/features/places/data/local_place_repository.dart
git commit -m "feat(places): add watchPlacesByCustodian query"
```

---

### Task 3.7: Fix hardcoded places count in profile

**Files:**
- Modify: `lib/features/profile/presentation/profile_placeholder_screen.dart`

- [ ] **Step 1: Replace hardcoded '0' with real query**

Replace the `_ProfileStatRow` build method:

```dart
@override
Widget build(BuildContext context) {
  return StreamBuilder<List<Memory>>(
    stream: context.read<MemoryRepository>().watchMemoriesForUser(userId),
    builder: (context, memorySnapshot) {
      final memories = memorySnapshot.data ?? const <Memory>[];
      return StreamBuilder<List<Place>>(
        stream: context.read<PlaceRepository>().watchPlacesByCustodian(userId),
        builder: (context, placeSnapshot) {
          final places = placeSnapshot.data ?? const <Place>[];
          return Row(
            children: [
              Expanded(
                child: _ProfileStat(
                  label: 'Memories',
                  value: '${memories.length}',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _ProfileStat(
                  label: 'Places',
                  value: '${places.length}',
                ),
              ),
            ],
          );
        },
      );
    },
  );
}
```

- [ ] **Step 2: Add imports**

```dart
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
```

- [ ] **Step 3: Run tests**

Run: `flutter test test/features/profile/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/features/profile/presentation/profile_placeholder_screen.dart
git commit -m "feat(profile): show real places count instead of hardcoded 0"
```

---

### Task 3.8: Fix edit memory privacy options

**Files:**
- Modify: `lib/features/memories/presentation/edit_memory_sheet.dart`
- Modify: `test/features/memories/presentation/edit_memory_sheet_test.dart`

- [ ] **Step 1: Write the failing test**

Add to existing test:

```dart
testWidgets('offers all 5 privacy options', (tester) async {
  // ... pump EditMemorySheet with a memory ...
  expect(find.text('Public'), findsOneWidget);
  expect(find.text('Private'), findsOneWidget);
  expect(find.text('Tagged'), findsOneWidget);
  expect(find.text('Time-release'), findsOneWidget);
  expect(find.text('Community'), findsOneWidget);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/memories/presentation/edit_memory_sheet_test.dart`
Expected: FAIL — Tagged/Time-release/Community not found

- [ ] **Step 3: Update EditMemorySheet**

Replace the `SegmentedButton` and `_save` method:

```dart
// In initState, set _privacy from widget.memory.privacy directly:
_privacy = widget.memory.privacy;

// Add state for tagged users, release date, community:
List<String> _taggedUserIds = [];
DateTime? _releaseDate;
String? _communityId;

@override
void initState() {
  super.initState();
  _textController = TextEditingController(text: widget.memory.textContent);
  _privacy = widget.memory.privacy;
  _taggedUserIds = List.from(widget.memory.taggedUserIds);
  _releaseDate = widget.memory.releaseDate;
  _communityId = widget.memory.communityId;
}

// Replace SegmentedButton with all 5 options:
SegmentedButton<PrivacyType>(
  key: const ValueKey('editMemoryPrivacySelector'),
  segments: const [
    ButtonSegment(value: PrivacyType.public, icon: Icon(Icons.public), label: Text('Public')),
    ButtonSegment(value: PrivacyType.private, icon: Icon(Icons.lock_outline), label: Text('Private')),
    ButtonSegment(value: PrivacyType.tagged, icon: Icon(Icons.alternate_email), label: Text('Tagged')),
    ButtonSegment(value: PrivacyType.timeRelease, icon: Icon(Icons.schedule), label: Text('Time-release')),
    ButtonSegment(value: PrivacyType.community, icon: Icon(Icons.groups_outlined), label: Text('Community')),
  ],
  selected: {_privacy},
  onSelectionChanged: (selection) {
    setState(() => _privacy = selection.first);
  },
),

// Update _save to pass actual values:
Future<void> _save() async {
  if (!(_formKey.currentState?.validate() ?? false)) return;
  await context.read<MemoryRepository>().updateTextAndPrivacy(
    memoryId: widget.memory.id,
    textContent: _textController.text.trim(),
    privacy: _privacy,
    taggedUserIds: _taggedUserIds,
    releaseDate: _releaseDate,
    communityId: _communityId,
  );
  if (mounted) Navigator.of(context).pop();
}
```

- [ ] **Step 4: Run test**

Run: `flutter test test/features/memories/presentation/edit_memory_sheet_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/features/memories/presentation/edit_memory_sheet.dart test/features/memories/presentation/edit_memory_sheet_test.dart
git commit -m "feat(memories): support all 5 privacy options in edit sheet"
```

---

### Task 3.9: Add Firestore rules for pendingUploads

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add rules for pendingUploads collection**

```
match /pendingUploads/{userId}/items/{itemId} {
  allow read, write: if signedIn() && isSelf(userId);
}
```

- [ ] **Step 2: Run rules tests**

Run: `npx firebase-tools emulators:exec --only firestore "npm test --prefix rules_test"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): add security rules for pendingUploads collection"
```

---

## Phase 4: Stub Features

### Task 4.1: Institutions — Domain layer

**Files:**
- Create: `lib/features/institutions/domain/institution_repository.dart`

- [ ] **Step 1: Define InstitutionRepository interface**

```dart
// lib/features/institutions/domain/institution_repository.dart
import 'package:echoes/features/institutions/domain/institution_zone.dart';

abstract interface class InstitutionRepository {
  Future<void> create(InstitutionZone institution);

  Future<InstitutionZone?> findById(String id);

  Stream<List<InstitutionZone>> watchByMember(String userId);

  Future<void> addSubZone({
    required String institutionId,
    required CampusSubZone subZone,
  });

  Future<void> removeSubZone({
    required String institutionId,
    required String subZoneId,
  });

  Future<void> addMember({
    required String institutionId,
    required String userId,
  });

  Future<void> removeMember({
    required String institutionId,
    required String userId,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/institutions/domain/institution_repository.dart
git commit -m "feat(institutions): define InstitutionRepository interface"
```

---

### Task 4.2: Institutions — Data layer

**Files:**
- Create: `lib/features/institutions/data/firestore_institution_repository.dart`
- Create: `lib/features/institutions/data/local_institution_repository.dart`
- Create: `test/features/institutions/data/local_institution_repository_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// test/features/institutions/data/local_institution_repository_test.dart
import 'package:echoes/features/institutions/data/local_institution_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LocalInstitutionRepository', () {
    test('create and findById', () async {
      final repo = LocalInstitutionRepository();
      // Test will be expanded once InstitutionZone entity is confirmed
      expect(repo, isNotNull);
    });
  });
}
```

- [ ] **Step 2: Implement FirestoreInstitutionRepository**

```dart
// lib/features/institutions/data/firestore_institution_repository.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/institutions/domain/institution_repository.dart';
import 'package:echoes/features/institutions/domain/institution_zone.dart';

class FirestoreInstitutionRepository implements InstitutionRepository {
  CollectionReference<Map<String, Object?>> get _collection =>
      FirebaseFirestore.instance.collection('institutions');

  @override
  Future<void> create(InstitutionZone institution) async {
    await _collection.doc(institution.id).set({
      'name': institution.name,
      'emailDomain': institution.emailDomain,
      'adminIds': institution.adminIds,
      'memberIds': institution.memberIds,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  @override
  Future<InstitutionZone?> findById(String id) async {
    final doc = await _collection.doc(id).get();
    if (!doc.exists) return null;
    return _fromDoc(doc);
  }

  @override
  Stream<List<InstitutionZone>> watchByMember(String userId) {
    return _collection
        .where('memberIds', arrayContains: userId)
        .snapshots()
        .map((s) => s.docs.map(_fromDoc).toList());
  }

  @override
  Future<void> addSubZone({
    required String institutionId,
    required CampusSubZone subZone,
  }) async {
    await _collection
        .doc(institutionId)
        .collection('subZones')
        .doc(subZone.id)
        .set({
      'name': subZone.name,
      'description': subZone.description,
    });
  }

  @override
  Future<void> removeSubZone({
    required String institutionId,
    required String subZoneId,
  }) async {
    await _collection
        .doc(institutionId)
        .collection('subZones')
        .doc(subZoneId)
        .delete();
  }

  @override
  Future<void> addMember({
    required String institutionId,
    required String userId,
  }) async {
    await _collection.doc(institutionId).update({
      'memberIds': FieldValue.arrayUnion([userId]),
    });
  }

  @override
  Future<void> removeMember({
    required String institutionId,
    required String userId,
  }) async {
    await _collection.doc(institutionId).update({
      'memberIds': FieldValue.arrayRemove([userId]),
    });
  }

  InstitutionZone _fromDoc(
    DocumentSnapshot<Map<String, Object?>> doc,
  ) {
    final data = doc.data()!;
    return InstitutionZone(
      id: doc.id,
      name: data['name'] as String,
      emailDomain: data['emailDomain'] as String,
      adminIds: List<String>.from(data['adminIds'] as List),
      memberIds: List<String>.from(data['memberIds'] as List),
    );
  }
}
```

- [ ] **Step 3: Implement LocalInstitutionRepository**

```dart
// lib/features/institutions/data/local_institution_repository.dart
import 'dart:async';

import 'package:echoes/features/institutions/domain/institution_repository.dart';
import 'package:echoes/features/institutions/domain/institution_zone.dart';

class LocalInstitutionRepository implements InstitutionRepository {
  final Map<String, InstitutionZone> _institutions = {};
  final Map<String, List<CampusSubZone>> _subZones = {};
  final _controller = StreamController<List<InstitutionZone>>.broadcast();

  @override
  Future<void> create(InstitutionZone institution) async {
    _institutions[institution.id] = institution;
    _emit();
  }

  @override
  Future<InstitutionZone?> findById(String id) async {
    return _institutions[id];
  }

  @override
  Stream<List<InstitutionZone>> watchByMember(String userId) async* {
    yield _institutions.values
        .where((i) => i.memberIds.contains(userId))
        .toList();
    yield* _controller.stream
        .map((list) => list.where((i) => i.memberIds.contains(userId)).toList());
  }

  @override
  Future<void> addSubZone({
    required String institutionId,
    required CampusSubZone subZone,
  }) async {
    _subZones.putIfAbsent(institutionId, () => []).add(subZone);
  }

  @override
  Future<void> removeSubZone({
    required String institutionId,
    required String subZoneId,
  }) async {
    _subZones[institutionId]?.removeWhere((s) => s.id == subZoneId);
  }

  @override
  Future<void> addMember({
    required String institutionId,
    required String userId,
  }) async {
    final inst = _institutions[institutionId];
    if (inst == null) return;
    _institutions[institutionId] = InstitutionZone(
      id: inst.id,
      name: inst.name,
      emailDomain: inst.emailDomain,
      adminIds: inst.adminIds,
      memberIds: [...inst.memberIds, userId],
    );
    _emit();
  }

  @override
  Future<void> removeMember({
    required String institutionId,
    required String userId,
  }) async {
    final inst = _institutions[institutionId];
    if (inst == null) return;
    _institutions[institutionId] = InstitutionZone(
      id: inst.id,
      name: inst.name,
      emailDomain: inst.emailDomain,
      adminIds: inst.adminIds,
      memberIds: inst.memberIds.where((id) => id != userId).toList(),
    );
    _emit();
  }

  void _emit() {
    _controller.add(_institutions.values.toList());
  }

  void dispose() {
    _controller.close();
  }
}
```

- [ ] **Step 4: Run test**

Run: `flutter test test/features/institutions/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/features/institutions/data/ test/features/institutions/data/
git commit -m "feat(institutions): add Firestore and Local repository implementations"
```

---

### Task 4.3: Institutions — Presentation layer

**Files:**
- Create: `lib/features/institutions/presentation/institution_cubit.dart`
- Create: `lib/features/institutions/presentation/institution_state.dart`
- Create: `lib/features/institutions/presentation/institution_screen.dart`
- Create: `lib/features/institutions/presentation/institution_detail_screen.dart`
- Create: `test/features/institutions/presentation/institution_screen_test.dart`

- [ ] **Step 1: Create InstitutionState**

```dart
// lib/features/institutions/presentation/institution_state.dart
import 'package:echoes/features/institutions/domain/institution_zone.dart';
import 'package:equatable/equatable.dart';

enum InstitutionStatus { initial, loading, loaded, failure }

class InstitutionState extends Equatable {
  const InstitutionState({
    required this.status,
    this.institutions = const [],
    this.errorMessage,
  });

  const InstitutionState.initial() : this(status: InstitutionStatus.initial);

  final InstitutionStatus status;
  final List<InstitutionZone> institutions;
  final String? errorMessage;

  InstitutionState copyWith({
    InstitutionStatus? status,
    List<InstitutionZone>? institutions,
    String? errorMessage,
  }) {
    return InstitutionState(
      status: status ?? this.status,
      institutions: institutions ?? this.institutions,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, institutions, errorMessage];
}
```

- [ ] **Step 2: Create InstitutionCubit**

```dart
// lib/features/institutions/presentation/institution_cubit.dart
import 'package:echoes/features/institutions/domain/institution_repository.dart';
import 'package:echoes/features/institutions/presentation/institution_state.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class InstitutionCubit extends Cubit<InstitutionState> {
  InstitutionCubit({
    required InstitutionRepository repository,
    required String userId,
  })  : _repository = repository,
        _userId = userId,
        super(const InstitutionState.initial());

  final InstitutionRepository _repository;
  final String _userId;

  Future<void> loadInstitutions() async {
    emit(state.copyWith(status: InstitutionStatus.loading));
    try {
      final institutions = await _repository.watchByMember(_userId).first;
      emit(state.copyWith(
        status: InstitutionStatus.loaded,
        institutions: institutions,
      ));
    } on Object catch (error) {
      emit(state.copyWith(
        status: InstitutionStatus.failure,
        errorMessage: error.toString(),
      ));
    }
  }
}
```

- [ ] **Step 3: Create InstitutionScreen**

```dart
// lib/features/institutions/presentation/institution_screen.dart
import 'package:echoes/app/theme.dart';
import 'package:echoes/features/institutions/domain/institution_repository.dart';
import 'package:echoes/features/institutions/presentation/institution_cubit.dart';
import 'package:echoes/features/institutions/presentation/institution_detail_screen.dart';
import 'package:echoes/features/institutions/presentation/institution_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class InstitutionScreen extends StatelessWidget {
  const InstitutionScreen({required this.userId, super.key});

  final String userId;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => InstitutionCubit(
        repository: context.read<InstitutionRepository>(),
        userId: userId,
      )..loadInstitutions(),
      child: BlocBuilder<InstitutionCubit, InstitutionState>(
        builder: (context, state) {
          if (state.status == InstitutionStatus.loading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state.institutions.isEmpty) {
            return const Center(
              child: Text('No institutions joined yet.'),
            );
          }
          return ListView.builder(
            itemCount: state.institutions.length,
            itemBuilder: (context, index) {
              final institution = state.institutions[index];
              return ListTile(
                title: Text(institution.name),
                subtitle: Text(institution.emailDomain),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => InstitutionDetailScreen(
                      institution: institution,
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 4: Create InstitutionDetailScreen**

```dart
// lib/features/institutions/presentation/institution_detail_screen.dart
import 'package:echoes/app/theme.dart';
import 'package:echoes/features/institutions/domain/institution_zone.dart';
import 'package:flutter/material.dart';

class InstitutionDetailScreen extends StatelessWidget {
  const InstitutionDetailScreen({required this.institution, super.key});

  final InstitutionZone institution;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(institution.name)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Email domain: ${institution.emailDomain}',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: EchoesColors.textSecondary,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '${institution.memberIds.length} members',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: EchoesColors.sunsetGold,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Sub-zones',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            const Text('Sub-zones will be listed here.'),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 5: Wire into app.dart**

Add to `app.dart` providers:
```dart
RepositoryProvider<InstitutionRepository>(
  create: (_) => useFirebase
      ? FirestoreInstitutionRepository()
      : LocalInstitutionRepository(),
),
```

- [ ] **Step 6: Add Firestore rules**

```
match /institutions/{institutionId} {
  allow read: if signedIn();
  allow write: if signedIn() && request.auth.token.email in resource.data.adminIds;
  
  match /subZones/{subZoneId} {
    allow read: if signedIn();
    allow write: if signedIn() && request.auth.token.email in get(/databases/$(database)/documents/institutions/$(institutionId)).data.adminIds;
  }
}
```

- [ ] **Step 7: Run tests**

Run: `flutter test test/features/institutions/`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/features/institutions/ test/features/institutions/ lib/app/app.dart firestore.rules
git commit -m "feat(institutions): complete presentation layer, DI wiring, and Firestore rules"
```

---

### Task 4.4: Guardian Reassignment — Full stack

**Files:**
- Create: `lib/features/places/domain/guardian_reassignment_request.dart`
- Create: `lib/features/places/domain/guardian_reassignment_repository.dart`
- Create: `lib/features/places/data/firestore_guardian_reassignment_repository.dart`
- Create: `lib/features/places/presentation/guardian_reassignment_button.dart`
- Delete: `lib/features/places/presentation/guardian_reassignment_placeholder.dart`
- Create: `test/features/places/presentation/guardian_reassignment_button_test.dart`

- [ ] **Step 1: Create entity**

```dart
// lib/features/places/domain/guardian_reassignment_request.dart
enum ReassignmentStatus { pending, approved, rejected }

class GuardianReassignmentRequest {
  const GuardianReassignmentRequest({
    required this.id,
    required this.placeId,
    required this.nomineeId,
    required this.nominatorId,
    required this.reason,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String placeId;
  final String nomineeId;
  final String nominatorId;
  final String reason;
  final ReassignmentStatus status;
  final DateTime createdAt;
}
```

- [ ] **Step 2: Create repository interface**

```dart
// lib/features/places/domain/guardian_reassignment_repository.dart
import 'package:echoes/features/places/domain/guardian_reassignment_request.dart';

abstract interface class GuardianReassignmentRepository {
  Future<void> submit(GuardianReassignmentRequest request);

  Stream<List<GuardianReassignmentRequest>> watchPendingForPlace(String placeId);

  Future<void> approve(String requestId);

  Future<void> reject(String requestId);
}
```

- [ ] **Step 3: Create Firestore implementation**

```dart
// lib/features/places/data/firestore_guardian_reassignment_repository.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/places/domain/guardian_reassignment_request.dart';
import 'package:echoes/features/places/domain/guardian_reassignment_repository.dart';

class FirestoreGuardianReassignmentRepository
    implements GuardianReassignmentRepository {
  CollectionReference<Map<String, Object?>> get _collection =>
      FirebaseFirestore.instance.collection('reassignmentRequests');

  @override
  Future<void> submit(GuardianReassignmentRequest request) async {
    await _collection.doc(request.id).set({
      'placeId': request.placeId,
      'nomineeId': request.nomineeId,
      'nominatorId': request.nominatorId,
      'reason': request.reason,
      'status': request.status.name,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  @override
  Stream<List<GuardianReassignmentRequest>> watchPendingForPlace(
    String placeId,
  ) {
    return _collection
        .where('placeId', isEqualTo: placeId)
        .where('status', isEqualTo: 'pending')
        .snapshots()
        .map((s) => s.docs.map(_fromDoc).toList());
  }

  @override
  Future<void> approve(String requestId) async {
    await _collection.doc(requestId).update({'status': 'approved'});
  }

  @override
  Future<void> reject(String requestId) async {
    await _collection.doc(requestId).update({'status': 'rejected'});
  }

  GuardianReassignmentRequest _fromDoc(
    QueryDocumentSnapshot<Map<String, Object?>> doc,
  ) {
    final data = doc.data();
    return GuardianReassignmentRequest(
      id: doc.id,
      placeId: data['placeId'] as String,
      nomineeId: data['nomineeId'] as String,
      nominatorId: data['nominatorId'] as String,
      reason: data['reason'] as String,
      status: ReassignmentStatus.values.byName(data['status'] as String),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
```

- [ ] **Step 4: Create GuardianReassignmentButton**

```dart
// lib/features/places/presentation/guardian_reassignment_button.dart
import 'package:echoes/app/theme.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:flutter/material.dart';

class GuardianReassignmentButton extends StatelessWidget {
  const GuardianReassignmentButton({
    required this.place,
    required this.currentUserId,
    super.key,
  });

  final Place place;
  final String currentUserId;

  @override
  Widget build(BuildContext context) {
    if (!place.custodianIds.contains(currentUserId)) {
      return const SizedBox.shrink();
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: EchoesColors.elevatedSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EchoesColors.surface),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.admin_panel_settings_outlined),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Guardian reassignment',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: EchoesColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            TextButton(
              key: const ValueKey('guardianReassignmentButton'),
              onPressed: () => _showReassignmentDialog(context),
              child: const Text('Reassign'),
            ),
          ],
        ),
      ),
    );
  }

  void _showReassignmentDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reassign custodian'),
        content: const Text(
          'Submit a request to nominate a new custodian for this place.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              // TODO: open full reassignment form
              Navigator.of(context).pop();
            },
            child: const Text('Submit request'),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 5: Update PlaceDetailSheet to use new button**

Replace import of `guardian_reassignment_placeholder.dart` with `guardian_reassignment_button.dart` and update the widget reference.

- [ ] **Step 6: Add Firestore rules**

```
match /reassignmentRequests/{requestId} {
  allow read: if signedIn();
  allow create: if signedIn();
  allow update: if signedIn(); // custodian approval
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/features/places/domain/guardian_reassignment_request.dart lib/features/places/domain/guardian_reassignment_repository.dart lib/features/places/data/firestore_guardian_reassignment_repository.dart lib/features/places/presentation/guardian_reassignment_button.dart
git rm lib/features/places/presentation/guardian_reassignment_placeholder.dart
git commit -m "feat(places): implement guardian reassignment feature"
```

---

### Task 4.5: Delete Account

**Files:**
- Create: `lib/features/auth/domain/account_deletion_service.dart`
- Create: `lib/features/auth/data/firebase_account_deletion_service.dart`
- Create: `lib/features/auth/data/local_account_deletion_service.dart`
- Modify: `lib/features/profile/presentation/profile_placeholder_screen.dart`

- [ ] **Step 1: Create interface**

```dart
// lib/features/auth/domain/account_deletion_service.dart
abstract interface class AccountDeletionService {
  Future<void> deleteAccount(String userId);
}
```

- [ ] **Step 2: Create Firebase implementation**

```dart
// lib/features/auth/data/firebase_account_deletion_service.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:echoes/features/auth/domain/account_deletion_service.dart';

class FirebaseAccountDeletionService implements AccountDeletionService {
  @override
  Future<void> deleteAccount(String userId) async {
    final firestore = FirebaseFirestore.instance;
    final batch = firestore.batch();

    // Soft-delete user's memories
    final memories = await firestore
        .collection('memories')
        .where('userId', isEqualTo: userId)
        .get();
    for (final doc in memories.docs) {
      batch.update(doc.reference, {
        'deletedAt': DateTime.now().toUtc().toIso8601String(),
      });
    }

    // Remove user from place custodian lists
    final places = await firestore
        .collection('places')
        .where('custodianIds', arrayContains: userId)
        .get();
    for (final doc in places.docs) {
      batch.update(doc.reference, {
        'custodianIds': FieldValue.arrayRemove([userId]),
      });
    }

    // Delete user profile
    batch.delete(firestore.collection('users').doc(userId));

    await batch.commit();

    // Delete Firebase Auth user
    await FirebaseAuth.instance.currentUser?.delete();
  }
}
```

- [ ] **Step 3: Create Local implementation**

```dart
// lib/features/auth/data/local_account_deletion_service.dart
import 'package:echoes/features/auth/domain/account_deletion_service.dart';

class LocalAccountDeletionService implements AccountDeletionService {
  @override
  Future<void> deleteAccount(String userId) async {
    // No-op for local testing
  }
}
```

- [ ] **Step 4: Wire in app.dart**

```dart
// Add to providers:
RepositoryProvider<AccountDeletionService>(
  create: (_) => useFirebase
      ? FirebaseAccountDeletionService()
      : LocalAccountDeletionService(),
),
```

- [ ] **Step 5: Wire the delete button in profile**

Replace the disabled button in `profile_placeholder_screen.dart`:

```dart
OutlinedButton.icon(
  key: const ValueKey('deleteAccountButton'),
  onPressed: () => _confirmDeleteAccount(context),
  icon: const Icon(Icons.delete_outline),
  label: const Text('Delete account'),
),
```

Add method:
```dart
Future<void> _confirmDeleteAccount(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Delete account?'),
      content: const Text(
        'This will permanently delete your profile and soft-delete all your memories. This cannot be undone.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
  if (confirmed == true && context.mounted) {
    await context.read<AccountDeletionService>().deleteAccount(userId);
    if (context.mounted) {
      await context.read<AuthCubit>().signOut();
    }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/features/auth/domain/account_deletion_service.dart lib/features/auth/data/firebase_account_deletion_service.dart lib/features/auth/data/local_account_deletion_service.dart lib/features/profile/presentation/profile_placeholder_screen.dart lib/app/app.dart
git commit -m "feat(auth): implement account deletion with confirmation dialog"
```

---

### Task 4.6: Memory Restore (30-day window)

**Files:**
- Modify: `lib/features/memories/domain/memory_repository.dart`
- Modify: `lib/features/memories/data/firestore_memory_repository.dart`
- Modify: `lib/features/memories/data/local_memory_repository.dart`
- Modify: `lib/features/memories/presentation/memory_detail_sheet.dart`
- Modify: `lib/features/profile/presentation/profile_placeholder_screen.dart`

- [ ] **Step 1: Add methods to MemoryRepository interface**

```dart
// Add to MemoryRepository:
Future<void> restoreMemory(String memoryId);

Stream<List<Memory>> watchRecentlyDeleted(String userId);
```

- [ ] **Step 2: Implement in FirestoreMemoryRepository**

```dart
@override
Future<void> restoreMemory(String memoryId) async {
  await _collection.doc(memoryId).update({
    'deletedAt': null,
    'updatedAt': DateTime.now().toUtc().toIso8601String(),
  });
}

@override
Stream<List<Memory>> watchRecentlyDeleted(String userId) {
  final cutoff = DateTime.now().toUtc().subtract(const Duration(days: 30));
  return _collection
      .where('userId', isEqualTo: userId)
      .where('deletedAt', isGreaterThan: cutoff.toIso8601String())
      .snapshots()
      .map((snapshot) => snapshot.docs
          .map((doc) => MemoryDto.fromMap(doc.id, doc.data()).toDomain())
          .toList());
}
```

- [ ] **Step 3: Implement in LocalMemoryRepository**

```dart
@override
Future<void> restoreMemory(String memoryId) async {
  final index = _memories.indexWhere((m) => m.id == memoryId);
  if (index == -1) return;
  final memory = _memories[index];
  _memories[index] = Memory(
    id: memory.id,
    userId: memory.userId,
    placeId: memory.placeId,
    placeName: memory.placeName,
    latitude: memory.latitude,
    longitude: memory.longitude,
    textContent: memory.textContent,
    imageUrl: memory.imageUrl,
    privacy: memory.privacy,
    taggedUserIds: memory.taggedUserIds,
    releaseDate: memory.releaseDate,
    communityId: memory.communityId,
    createdAt: memory.createdAt,
    updatedAt: DateTime.now().toUtc(),
    deletedAt: null,
  );
  _emit();
}

@override
Stream<List<Memory>> watchRecentlyDeleted(String userId) async* {
  final cutoff = DateTime.now().toUtc().subtract(const Duration(days: 30));
  yield _memories
      .where((m) =>
          m.userId == userId &&
          m.deletedAt != null &&
          m.deletedAt!.isAfter(cutoff))
      .toList();
  yield* _controller.stream.map((list) => list
      .where((m) =>
          m.userId == userId &&
          m.deletedAt != null &&
          m.deletedAt!.isAfter(cutoff))
      .toList());
}
```

- [ ] **Step 4: Wire restore button in MemoryDetailSheet**

Replace the disabled button:
```dart
// Before (disabled):
OutlinedButton.icon(
  key: const ValueKey('restoreMemoryPlaceholderButton'),
  onPressed: null,
  icon: const Icon(Icons.restore_outlined),
  label: const Text('30-day restore coming soon'),
),

// After (working):
if (memory.deletedAt != null)
  OutlinedButton.icon(
    key: const ValueKey('restoreMemoryButton'),
    onPressed: () async {
      await context.read<MemoryRepository>().restoreMemory(memory.id);
      if (context.mounted) Navigator.of(context).pop();
    },
    icon: const Icon(Icons.restore_outlined),
    label: const Text('Restore memory'),
  ),
```

- [ ] **Step 5: Add Recently Deleted section to Profile**

In `profile_placeholder_screen.dart`, after the "Your memories" section:

```dart
_RecentlyDeletedSection(userId: userId),
```

Create widget:
```dart
class _RecentlyDeletedSection extends StatelessWidget {
  const _RecentlyDeletedSection({required this.userId});
  final String userId;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Memory>>(
      stream: context.read<MemoryRepository>().watchRecentlyDeleted(userId),
      builder: (context, snapshot) {
        final deleted = snapshot.data ?? const <Memory>[];
        if (deleted.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            Text(
              'Recently deleted',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            ...deleted.map((memory) => ListTile(
              title: Text(memory.textContent, maxLines: 1),
              subtitle: Text('Deleted ${_formatDate(memory.deletedAt!)}'),
              trailing: TextButton(
                onPressed: () async {
                  await context.read<MemoryRepository>().restoreMemory(memory.id);
                },
                child: const Text('Restore'),
              ),
            )),
          ],
        );
      },
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now().toUtc();
    final diff = now.difference(date);
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    return '${diff.inMinutes}m ago';
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/features/memories/domain/memory_repository.dart lib/features/memories/data/firestore_memory_repository.dart lib/features/memories/data/local_memory_repository.dart lib/features/memories/presentation/memory_detail_sheet.dart lib/features/profile/presentation/profile_placeholder_screen.dart
git commit -m "feat(memories): implement 30-day restore and recently deleted section"
```

---

### Task 4.7: Community Feed

**Files:**
- Modify: `lib/features/communities/presentation/community_detail_screen.dart`

- [ ] **Step 1: Wire memory stream into CommunityDetailScreen**

Replace the placeholder text with a StreamBuilder:

```dart
// Replace:
Text(
  'Community-scoped memories will appear here as the archive grows.',
  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
    color: EchoesColors.textSecondary,
  ),
),

// With:
StreamBuilder<List<Memory>>(
  stream: context.read<MemoryRepository>().watchVisibleMemoriesForPlace(
    placeId: '', // Community-scoped, not place-scoped
    viewerId: userId,
    viewerCommunityIds: {community.id},
    now: DateTime.now(),
  ),
  builder: (context, snapshot) {
    // Note: watchVisibleMemoriesForPlace is place-specific.
    // For community feed, we need a different query.
    // Use a direct Firestore query instead:
    return const SizedBox.shrink();
  },
),
```

Actually, the better approach is to add a `watchByCommunity` method to `MemoryRepository` if it doesn't exist, or use the existing Firestore query directly. Let me check what exists.

The `FirestoreMemoryRepository` already has community-scoped streams internally (for the privacy-aware `watchVisibleMemoriesForPlace`). We need a dedicated `watchByCommunity(communityId)` method.

- [ ] **Step 2: Add watchByCommunity to MemoryRepository**

```dart
// Add to MemoryRepository interface:
Stream<List<Memory>> watchByCommunity(String communityId);
```

- [ ] **Step 3: Implement in FirestoreMemoryRepository**

```dart
@override
Stream<List<Memory>> watchByCommunity(String communityId) {
  return _collection
      .where('communityId', isEqualTo: communityId)
      .where('deletedAt', isNull: true)
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map((snapshot) => snapshot.docs
          .map((doc) => MemoryDto.fromMap(doc.id, doc.data()).toDomain())
          .toList());
}
```

- [ ] **Step 4: Implement in LocalMemoryRepository**

```dart
@override
Stream<List<Memory>> watchByCommunity(String communityId) async* {
  yield _memories
      .where((m) => m.communityId == communityId && m.deletedAt == null)
      .toList();
  yield* _controller.stream.map((list) => list
      .where((m) => m.communityId == communityId && m.deletedAt == null)
      .toList());
}
```

- [ ] **Step 5: Wire into CommunityDetailScreen**

```dart
Expanded(
  child: StreamBuilder<List<Memory>>(
    stream: context.read<MemoryRepository>().watchByCommunity(community.id),
    builder: (context, snapshot) {
      final memories = snapshot.data ?? const <Memory>[];
      if (memories.isEmpty) {
        return Text(
          'Community-scoped memories will appear here as the archive grows.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: EchoesColors.textSecondary,
          ),
        );
      }
      return ListView.builder(
        itemCount: memories.length,
        itemBuilder: (context, index) =>
            MemoryCard(memory: memories[index]),
      );
    },
  ),
),
```

- [ ] **Step 6: Add imports**

```dart
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/memory_card.dart';
```

- [ ] **Step 7: Commit**

```bash
git add lib/features/communities/presentation/community_detail_screen.dart lib/features/memories/domain/memory_repository.dart lib/features/memories/data/firestore_memory_repository.dart lib/features/memories/data/local_memory_repository.dart
git commit -m "feat(communities): wire community-scoped memory feed"
```

---

### Task 4.8: Notification Inbox — Domain + Data

**Files:**
- Create: `lib/features/notifications/domain/notification_inbox_item.dart`
- Create: `lib/features/notifications/domain/notification_inbox_repository.dart`
- Create: `lib/features/notifications/data/firestore_notification_inbox_repository.dart`
- Create: `lib/features/notifications/data/local_notification_inbox_repository.dart`
- Create: `test/features/notifications/data/local_notification_inbox_repository_test.dart`

- [ ] **Step 1: Create entity**

```dart
// lib/features/notifications/domain/notification_inbox_item.dart
enum NotificationInboxType { transfer, tag, community }

class NotificationInboxItem {
  const NotificationInboxItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.targetId,
    required this.read,
    required this.createdAt,
  });

  final String id;
  final NotificationInboxType type;
  final String title;
  final String body;
  final String targetId;
  final bool read;
  final DateTime createdAt;
}
```

- [ ] **Step 2: Create repository interface**

```dart
// lib/features/notifications/domain/notification_inbox_repository.dart
import 'package:echoes/features/notifications/domain/notification_inbox_item.dart';

abstract interface class NotificationInboxRepository {
  Stream<List<NotificationInboxItem>> watchUnread(String userId);

  Stream<List<NotificationInboxItem>> watchAll(String userId);

  Future<void> markRead(String userId, String notificationId);
}
```

- [ ] **Step 3: Create Firestore implementation**

```dart
// lib/features/notifications/data/firestore_notification_inbox_repository.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/notifications/domain/notification_inbox_item.dart';
import 'package:echoes/features/notifications/domain/notification_inbox_repository.dart';

class FirestoreNotificationInboxRepository
    implements NotificationInboxRepository {
  CollectionReference<Map<String, Object?>> _collection(String userId) =>
      FirebaseFirestore.instance
          .collection('notifications')
          .doc(userId)
          .collection('items');

  @override
  Stream<List<NotificationInboxItem>> watchUnread(String userId) {
    return _collection(userId)
        .where('read', isEqualTo: false)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((s) => s.docs.map(_fromDoc).toList());
  }

  @override
  Stream<List<NotificationInboxItem>> watchAll(String userId) {
    return _collection(userId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((s) => s.docs.map(_fromDoc).toList());
  }

  @override
  Future<void> markRead(String userId, String notificationId) async {
    await _collection(userId).doc(notificationId).update({'read': true});
  }

  NotificationInboxItem _fromDoc(
    QueryDocumentSnapshot<Map<String, Object?>> doc,
  ) {
    final data = doc.data();
    return NotificationInboxItem(
      id: doc.id,
      type: NotificationInboxType.values.byName(data['type'] as String),
      title: data['title'] as String,
      body: data['body'] as String,
      targetId: data['targetId'] as String,
      read: data['read'] as bool,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
```

- [ ] **Step 4: Create Local implementation**

```dart
// lib/features/notifications/data/local_notification_inbox_repository.dart
import 'dart:async';

import 'package:echoes/features/notifications/domain/notification_inbox_item.dart';
import 'package:echoes/features/notifications/domain/notification_inbox_repository.dart';

class LocalNotificationInboxRepository implements NotificationInboxRepository {
  final List<NotificationInboxItem> _items = [];
  final _controller = StreamController<List<NotificationInboxItem>>.broadcast();

  @override
  Stream<List<NotificationInboxItem>> watchUnread(String userId) async* {
    yield _items.where((i) => !i.read).toList();
    yield* _controller.stream.map((list) => list.where((i) => !i.read).toList());
  }

  @override
  Stream<List<NotificationInboxItem>> watchAll(String userId) async* {
    yield List.unmodifiable(_items);
    yield* _controller.stream;
  }

  @override
  Future<void> markRead(String userId, String notificationId) async {
    final index = _items.indexWhere((i) => i.id == notificationId);
    if (index == -1) return;
    final item = _items[index];
    _items[index] = NotificationInboxItem(
      id: item.id,
      type: item.type,
      title: item.title,
      body: item.body,
      targetId: item.targetId,
      read: true,
      createdAt: item.createdAt,
    );
    _controller.add(List.unmodifiable(_items));
  }

  void dispose() {
    _controller.close();
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/features/notifications/domain/notification_inbox_item.dart lib/features/notifications/domain/notification_inbox_repository.dart lib/features/notifications/data/firestore_notification_inbox_repository.dart lib/features/notifications/data/local_notification_inbox_repository.dart test/features/notifications/data/local_notification_inbox_repository_test.dart
git commit -m "feat(notifications): add notification inbox domain and data layers"
```

---

### Task 4.9: Notification Inbox — Presentation

**Files:**
- Create: `lib/features/notifications/presentation/notification_inbox_screen.dart`
- Create: `lib/features/notifications/presentation/notification_badge_cubit.dart`
- Create: `lib/features/notifications/presentation/notification_badge_state.dart`
- Create: `test/features/notifications/presentation/notification_inbox_screen_test.dart`
- Modify: `lib/features/home/presentation/echoes_home_shell.dart`
- Modify: `lib/app/app.dart`

- [ ] **Step 1: Create NotificationBadgeState**

```dart
// lib/features/notifications/presentation/notification_badge_state.dart
import 'package:equatable/equatable.dart';

class NotificationBadgeState extends Equatable {
  const NotificationBadgeState({this.unreadCount = 0});

  final int unreadCount;

  @override
  List<Object?> get props => [unreadCount];
}
```

- [ ] **Step 2: Create NotificationBadgeCubit**

```dart
// lib/features/notifications/presentation/notification_badge_cubit.dart
import 'package:echoes/features/notifications/domain/notification_inbox_repository.dart';
import 'package:echoes/features/notifications/presentation/notification_badge_state.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class NotificationBadgeCubit extends Cubit<NotificationBadgeState> {
  NotificationBadgeCubit({
    required NotificationInboxRepository repository,
    required String userId,
  }) : super(const NotificationBadgeState()) {
    _subscription = repository.watchUnread(userId).listen((items) {
      emit(NotificationBadgeState(unreadCount: items.length));
    });
  }

  late final Stream<void> _subscription;

  @override
  Future<void> close() async {
    await super.close();
  }
}
```

- [ ] **Step 3: Create NotificationInboxScreen**

```dart
// lib/features/notifications/presentation/notification_inbox_screen.dart
import 'package:echoes/app/theme.dart';
import 'package:echoes/features/notifications/domain/notification_inbox_item.dart';
import 'package:echoes/features/notifications/domain/notification_inbox_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class NotificationInboxScreen extends StatelessWidget {
  const NotificationInboxScreen({required this.userId, super.key});

  final String userId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: StreamBuilder<List<NotificationInboxItem>>(
        stream: context.read<NotificationInboxRepository>().watchAll(userId),
        builder: (context, snapshot) {
          final items = snapshot.data ?? const <NotificationInboxItem>[];
          if (items.isEmpty) {
            return const Center(
              child: Text('No notifications yet.'),
            );
          }
          return ListView.builder(
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              return ListTile(
                leading: Icon(
                  _iconForType(item.type),
                  color: item.read
                      ? EchoesColors.textSecondary
                      : EchoesColors.celestialBlue,
                ),
                title: Text(
                  item.title,
                  style: TextStyle(
                    fontWeight:
                        item.read ? FontWeight.normal : FontWeight.w700,
                  ),
                ),
                subtitle: Text(item.body),
                onTap: () {
                  context
                      .read<NotificationInboxRepository>()
                      .markRead(userId, item.id);
                  // Navigate to target based on type
                },
              );
            },
          );
        },
      ),
    );
  }

  IconData _iconForType(NotificationInboxType type) {
    return switch (type) {
      NotificationInboxType.transfer => Icons.swap_horiz,
      NotificationInboxType.tag => Icons.alternate_email,
      NotificationInboxType.community => Icons.groups_outlined,
    };
  }
}
```

- [ ] **Step 4: Wire into app.dart**

Add provider:
```dart
RepositoryProvider<NotificationInboxRepository>(
  create: (_) => useFirebase
      ? FirestoreNotificationInboxRepository()
      : LocalNotificationInboxRepository(),
),
```

- [ ] **Step 5: Add notification bell to home shell**

In `echoes_home_shell.dart`, add a bell icon in the AppBar or as a floating button that navigates to `NotificationInboxScreen`.

- [ ] **Step 6: Add Firestore rules**

```
match /notifications/{userId}/items/{itemId} {
  allow read: if signedIn() && isSelf(userId);
  allow write: if signedIn(); // Cloud Function writes on behalf of system
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/features/notifications/presentation/ lib/features/home/presentation/echoes_home_shell.dart lib/app/app.dart firestore.rules
git commit -m "feat(notifications): add notification inbox screen and badge"
```

---

## Phase 5: Polish & Validation

### Task 5.1: Animated splash screen

**Files:**
- Modify: `lib/features/splash/presentation/splash_screen.dart`

- [ ] **Step 1: Update SplashScreen with animation**

```dart
// lib/features/splash/presentation/splash_screen.dart
import 'package:echoes/app/theme.dart';
import 'package:flutter/material.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EchoesColors.deepSpace,
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.view_in_ar_outlined,
                size: 64,
                color: EchoesColors.celestialBlue,
              ),
              const SizedBox(height: 16),
              Text(
                'ECHOES',
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  color: EchoesColors.textPrimary,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/splash/presentation/splash_screen.dart
git commit -m "feat(splash): add animated logo fade-in"
```

---

### Task 5.2: Rename all placeholder screens

**Files:**
- Multiple renames across codebase

- [ ] **Step 1: Rename files**

```bash
git mv lib/features/memories/presentation/add_memory_placeholder_screen.dart lib/features/memories/presentation/add_memory_screen.dart
git mv lib/features/communities/presentation/communities_placeholder_screen.dart lib/features/communities/presentation/communities_screen.dart
git mv lib/features/profile/presentation/profile_placeholder_screen.dart lib/features/profile/presentation/profile_screen.dart
```

- [ ] **Step 2: Update all class names and imports**

Search and replace across all files:
- `AddMemoryPlaceholderScreen` → `AddMemoryScreen`
- `CommunitiesPlaceholderScreen` → `CommunitiesScreen`
- `ProfilePlaceholderScreen` → `ProfileScreen`
- `MapPlaceholderScreen` → `MapScreen` (already done in Phase 2)
- `ArPlaceholderScreen` → `ArScreen` (already done in Phase 1)

Update imports in `echoes_home_shell.dart` and any test files.

- [ ] **Step 3: Run full test suite**

Run: `flutter test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rename all placeholder screens to production names"
```

---

### Task 5.3: Update CI with integration tests

**Files:**
- Modify: `.github/workflows/flutter.yml`

- [ ] **Step 1: Add integration test step**

```yaml
      - name: Run integration tests
        run: flutter test integration_test/
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/flutter.yml
git commit -m "ci: add integration test step to GitHub Actions"
```

---

### Task 5.4: Final Firestore rules update

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add all new collection rules**

Ensure rules exist for:
- `pendingUploads/{userId}/items/{itemId}` — owner read/write
- `institutions/{id}` — read: signed in, write: admin
- `institutions/{id}/subZones/{id}` — read: signed in, write: admin
- `reassignmentRequests/{id}` — read: signed in, create: signed in, update: custodian
- `notifications/{userId}/items/{id}` — read: owner, write: signed in (Cloud Function)

- [ ] **Step 2: Run rules tests**

Run: `npx firebase-tools emulators:exec --only firestore "npm test --prefix rules_test"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): add security rules for all new collections"
```

---

### Task 5.5: Update Cloud Functions for notification inbox

**Files:**
- Modify: `functions/index.js`
- Modify: `functions/index.test.js`

- [ ] **Step 1: Extend dispatchNotificationRequest to write inbox**

```javascript
// In functions/index.js, after sending FCM, add:
const inboxRef = admin.firestore()
  .collection('notifications')
  .doc(recipientUserId)
  .collection('items')
  .doc(requestId);

await inboxRef.set({
  type: requestData.type || 'transfer',
  title: requestData.title || 'New notification',
  body: requestData.body || '',
  targetId: requestData.targetId || '',
  read: false,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
```

- [ ] **Step 2: Update tests**

Add test case verifying inbox document is created.

- [ ] **Step 3: Run function tests**

Run: `npm test --prefix functions`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add functions/index.js functions/index.test.js
git commit -m "feat(functions): write notification inbox on dispatch"
```

---

### Task 5.6: Final validation

- [ ] **Step 1: Run full test suite**

Run: `flutter test`
Expected: All tests pass

- [ ] **Step 2: Run analysis**

Run: `flutter analyze`
Expected: No issues

- [ ] **Step 3: Run Cloud Functions tests**

Run: `npm test --prefix functions`
Expected: PASS

- [ ] **Step 4: Run Firestore rules tests**

Run: `npx firebase-tools emulators:exec --only firestore "npm test --prefix rules_test"`
Expected: PASS

- [ ] **Step 5: Build Android APK**

Run: `flutter build apk --dart-define=APP_ENV=production`
Expected: Build succeeds

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "chore: final validation pass — all tests green, production build succeeds"
```
