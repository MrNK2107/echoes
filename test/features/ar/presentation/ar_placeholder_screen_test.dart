import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/core/location/location_permission_state.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/ar/data/local_ar_availability_service.dart';
import 'package:echoes/features/ar/data/local_ar_permission_service.dart';
import 'package:echoes/features/ar/data/local_ar_session_service.dart';
import 'package:echoes/features/ar/domain/ar_availability.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_state.dart';
import 'package:echoes/features/ar/domain/ar_session_service.dart';
import 'package:echoes/features/ar/presentation/ar_placeholder_screen.dart';
import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ArPlaceholderScreen uses low-chrome controls while running', (
    tester,
  ) async {
    await tester.pumpWidget(const _TestApp());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('startArSessionButton')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.byKey(const ValueKey('arStatusPill')), findsOneWidget);
    expect(find.text('Tracking 1 place'), findsOneWidget);
    expect(find.byKey(const ValueKey('stopArSessionButton')), findsOneWidget);
    expect(find.byKey(const ValueKey('arSceneSummary')), findsOneWidget);
    expect(find.textContaining('Old Courtyard'), findsWidgets);
    expect(find.text('Stop aura view'), findsNothing);
  });

  testWidgets('ArPlaceholderScreen opens memory detail from orb tap', (
    tester,
  ) async {
    await tester.pumpWidget(const _TestApp());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('startArSessionButton')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    await tester.tapAt(const Offset(413, 427));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));

    expect(find.text('A memory from AR.'), findsOneWidget);
    expect(find.textContaining('Created 17/05/2026'), findsOneWidget);
  });
}

class _TestApp extends StatelessWidget {
  const _TestApp();

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<ArAvailabilityService>(
          create: (_) => const LocalArAvailabilityService(
            availability: ArAvailability.supported,
          ),
        ),
        RepositoryProvider<ArPermissionService>(
          create: (_) => const LocalArPermissionService(
            initialPermission: ArPermissionState.granted,
          ),
        ),
        RepositoryProvider<ArSessionService>(
          create: (_) => LocalArSessionService(),
        ),
        RepositoryProvider<LocationService>(
          create: (_) => const _FakeLocationService(),
        ),
        RepositoryProvider<PlaceRepository>(
          create: (_) => const _FakePlaceRepository(),
        ),
        RepositoryProvider<MemoryRepository>(
          create: (_) => const _FakeMemoryRepository(),
        ),
      ],
      child: const MaterialApp(home: Scaffold(body: ArPlaceholderScreen())),
    );
  }
}

class _FakeMemoryRepository implements MemoryRepository {
  const _FakeMemoryRepository();

  @override
  Future<void> create(Memory memory) async {}

  @override
  Future<Memory?> findById(String id) async => null;

  @override
  Future<void> softDelete({
    required String memoryId,
    required DateTime deletedAt,
  }) async {}

  @override
  Future<void> updateImageUrl({
    required String memoryId,
    required String imageUrl,
    required DateTime updatedAt,
  }) async {}

  @override
  Future<void> updateTextAndPrivacy({
    required String memoryId,
    required String textContent,
    required PrivacyType privacy,
    required List<String> taggedUserIds,
    required DateTime? releaseDate,
    required String? communityId,
  }) async {}

  @override
  Stream<List<Memory>> watchMemoriesForPlace(String placeId) {
    return Stream.value([_memory()]);
  }

  @override
  Stream<List<Memory>> watchMemoriesForUser(String userId) {
    return Stream.value([_memory()]);
  }

  @override
  Stream<List<Memory>> watchVisibleMemoriesForPlace({
    required String placeId,
    required String viewerId,
    required Set<String> viewerCommunityIds,
    required DateTime now,
  }) {
    return Stream.value([_memory()]);
  }
}

class _FakeLocationService implements LocationService {
  const _FakeLocationService();

  @override
  Future<LocationPermissionState> checkPermission() async {
    return LocationPermissionState.granted;
  }

  @override
  Future<DeviceLocation> getCurrentLocation() async {
    return const DeviceLocation(
      latitude: 12.9716,
      longitude: 77.5946,
      accuracyMeters: 10,
    );
  }

  @override
  Future<LocationPermissionState> requestPermission() async {
    return LocationPermissionState.granted;
  }
}

class _FakePlaceRepository implements PlaceRepository {
  const _FakePlaceRepository();

  @override
  Future<void> create(Place place) async {}

  @override
  Future<Place?> findById(String id) async => null;

  @override
  Future<Place?> findNearestPlace({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) async {
    return _place();
  }

  @override
  Future<void> save(Place place) async {}

  @override
  Stream<List<Place>> watchNearbyPlaces({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) {
    return Stream.value([_place()]);
  }
}

Place _place() {
  final now = DateTime.utc(2026, 5, 17);
  return Place(
    id: 'place-1',
    name: 'Old Courtyard',
    latitude: 12.9717,
    longitude: 77.5947,
    geohash: 'tdr1v',
    custodianIds: const ['user-1'],
    aura: AuraZone.empty(now),
    memoryCount: 3,
    publicMemoryCount: 3,
    createdAt: now,
    updatedAt: now,
  );
}

Memory _memory() {
  return Memory(
    id: 'memory-1',
    userId: 'user-1',
    placeId: 'place-1',
    textContent: 'A memory from AR.',
    latitude: 12.9717,
    longitude: 77.5947,
    geohash: 'tdr1v',
    sentiment: const SentimentResult(
      compound: 0.2,
      positive: 0.3,
      neutral: 0.7,
      negative: 0,
    ),
    privacy: PrivacyType.public,
    taggedUserIds: const [],
    isDeleted: false,
    createdAt: DateTime.utc(2026, 5, 17),
    updatedAt: DateTime.utc(2026, 5, 17),
  );
}
