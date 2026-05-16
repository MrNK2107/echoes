import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/core/location/location_permission_state.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/ar/data/local_ar_availability_service.dart';
import 'package:echoes/features/ar/data/local_ar_permission_service.dart';
import 'package:echoes/features/ar/data/local_ar_session_service.dart';
import 'package:echoes/features/ar/domain/ar_availability.dart';
import 'package:echoes/features/ar/domain/ar_permission_state.dart';
import 'package:echoes/features/ar/presentation/ar_cubit.dart';
import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ArCubit', () {
    test('enters ready state when AR is supported', () async {
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(
          availability: ArAvailability.supported,
        ),
        permissionService: const LocalArPermissionService(
          initialPermission: ArPermissionState.granted,
        ),
        sessionService: LocalArSessionService(),
        locationService: _FakeLocationService(),
        placeRepository: _FakePlaceRepository(),
      );

      await cubit.checkAvailability();

      expect(cubit.state.status, ArStatus.ready);
      await cubit.close();
    });

    test('enters fallback state when AR is unsupported', () async {
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(),
        permissionService: const LocalArPermissionService(),
        sessionService: LocalArSessionService(),
        locationService: _FakeLocationService(),
        placeRepository: _FakePlaceRepository(),
      );

      await cubit.checkAvailability();

      expect(cubit.state.status, ArStatus.unsupported);
      await cubit.close();
    });

    test('requires camera permission before AR can start', () async {
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(
          availability: ArAvailability.supported,
        ),
        permissionService: const LocalArPermissionService(
          initialPermission: ArPermissionState.denied,
        ),
        sessionService: LocalArSessionService(),
        locationService: _FakeLocationService(),
        placeRepository: _FakePlaceRepository(),
      );

      await cubit.checkAvailability();

      expect(cubit.state.status, ArStatus.permissionDenied);
      await cubit.close();
    });

    test('enters ready state after camera permission is granted', () async {
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(
          availability: ArAvailability.supported,
        ),
        permissionService: const LocalArPermissionService(
          initialPermission: ArPermissionState.denied,
          requestedPermission: ArPermissionState.granted,
        ),
        sessionService: LocalArSessionService(),
        locationService: _FakeLocationService(),
        placeRepository: _FakePlaceRepository(),
      );

      await cubit.requestPermission();

      expect(cubit.state.status, ArStatus.ready);
      await cubit.close();
    });

    test('starts and stops an AR session safely', () async {
      final sessionService = LocalArSessionService();
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(
          availability: ArAvailability.supported,
        ),
        permissionService: const LocalArPermissionService(
          initialPermission: ArPermissionState.granted,
        ),
        sessionService: sessionService,
        locationService: _FakeLocationService(),
        placeRepository: _FakePlaceRepository(places: [_place()]),
      );

      await cubit.checkAvailability();
      await cubit.startSession();

      expect(cubit.state.status, ArStatus.running);
      expect(cubit.state.isSessionRunning, isTrue);
      expect(cubit.state.nearbyPlaces, hasLength(1));
      expect(cubit.state.scenePlaces, hasLength(1));
      expect(sessionService.isRunning, isTrue);

      cubit.selectScenePlace('place-1');

      expect(cubit.state.selectedScenePlaceId, 'place-1');
      expect(cubit.state.selectedScenePlace?.place.name, 'Old Courtyard');

      await cubit.stopSession();

      expect(cubit.state.status, ArStatus.ready);
      expect(cubit.state.isSessionRunning, isFalse);
      expect(cubit.state.selectedScenePlaceId, isNull);
      expect(sessionService.isRunning, isFalse);
      await cubit.close();
    });

    test('stops a running AR session when closed', () async {
      final sessionService = LocalArSessionService();
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(
          availability: ArAvailability.supported,
        ),
        permissionService: const LocalArPermissionService(
          initialPermission: ArPermissionState.granted,
        ),
        sessionService: sessionService,
        locationService: _FakeLocationService(),
        placeRepository: _FakePlaceRepository(),
      );

      await cubit.checkAvailability();
      await cubit.startSession();
      await cubit.close();

      expect(sessionService.isRunning, isFalse);
    });
  });
}

class _FakeLocationService implements LocationService {
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
  const _FakePlaceRepository({this.places = const []});

  final List<Place> places;

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
    return places.isEmpty ? null : places.first;
  }

  @override
  Future<void> save(Place place) async {}

  @override
  Stream<List<Place>> watchNearbyPlaces({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) {
    return Stream.value(places);
  }
}

Place _place() {
  final now = DateTime.utc(2026, 5, 16);
  return Place(
    id: 'place-1',
    name: 'Old Courtyard',
    latitude: 12.9717,
    longitude: 77.5947,
    geohash: 'tdr1v',
    custodianIds: const ['user-1'],
    aura: AuraZone.empty(now),
    memoryCount: 1,
    publicMemoryCount: 1,
    createdAt: now,
    updatedAt: now,
  );
}
