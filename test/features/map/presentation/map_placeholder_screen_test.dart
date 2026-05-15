import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/core/location/location_permission_state.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/map/presentation/map_placeholder_screen.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('MapPlaceholderScreen', () {
    testWidgets('renders initial location prompt', (tester) async {
      await tester.pumpWidget(
        _TestApp(
          locationService: _FakeLocationService(
            permission: LocationPermissionState.unknown,
          ),
        ),
      );

      expect(find.text('Places remember first.'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('requestLocationButton')),
        findsOneWidget,
      );
    });

    testWidgets('renders denied message when permission is declined', (
      tester,
    ) async {
      await tester.pumpWidget(
        _TestApp(
          locationService: _FakeLocationService(
            permission: LocationPermissionState.denied,
          ),
        ),
      );

      await tester.tap(find.byKey(const ValueKey('requestLocationButton')));
      await tester.pumpAndSettle();

      expect(
        find.text('Location access is needed to discover nearby memories.'),
        findsOneWidget,
      );
    });

    testWidgets('renders blocked message when permission is denied forever', (
      tester,
    ) async {
      await tester.pumpWidget(
        _TestApp(
          locationService: _FakeLocationService(
            permission: LocationPermissionState.deniedForever,
          ),
        ),
      );

      await tester.tap(find.byKey(const ValueKey('requestLocationButton')));
      await tester.pumpAndSettle();

      expect(
        find.text(
          'Location access is blocked. Enable it in system settings to use the map.',
        ),
        findsOneWidget,
      );
    });
  });
}

class _TestApp extends StatelessWidget {
  const _TestApp({required this.locationService});

  final LocationService locationService;

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<LocationService>.value(value: locationService),
        RepositoryProvider<PlaceRepository>.value(
          value: _EmptyPlaceRepository(),
        ),
      ],
      child: const MaterialApp(home: Scaffold(body: MapPlaceholderScreen())),
    );
  }
}

class _FakeLocationService implements LocationService {
  _FakeLocationService({required this.permission});

  LocationPermissionState permission;

  @override
  Future<LocationPermissionState> checkPermission() async => permission;

  @override
  Future<DeviceLocation> getCurrentLocation() async {
    return const DeviceLocation(
      latitude: 12.9716,
      longitude: 77.5946,
      accuracyMeters: 12,
    );
  }

  @override
  Future<LocationPermissionState> requestPermission() async => permission;
}

class _EmptyPlaceRepository implements PlaceRepository {
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
    return null;
  }

  @override
  Future<void> save(Place place) async {}

  @override
  Stream<List<Place>> watchNearbyPlaces({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) {
    return Stream.value(const []);
  }
}
