import 'package:echoes/core/geo/geohash.dart';
import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/places/data/local_place_repository.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LocalPlaceRepository', () {
    test('findNearestPlace returns the closest place inside radius', () async {
      final repository = LocalPlaceRepository(now: DateTime.utc(2026, 5, 15));

      final place = await repository.findNearestPlace(
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 100,
      );

      expect(place?.id, 'college-courtyard');
    });

    test('findNearestPlace ignores places outside radius', () async {
      final repository = LocalPlaceRepository(now: DateTime.utc(2026, 5, 15));

      final place = await repository.findNearestPlace(
        latitude: 13.05,
        longitude: 77.65,
        radiusMeters: 100,
      );

      expect(place, isNull);
    });

    test('watchNearbyPlaces filters by radius', () async {
      final now = DateTime.utc(2026, 5, 15);
      final repository = LocalPlaceRepository(now: now);
      await repository.create(
        _place(id: 'far-place', latitude: 13.05, now: now),
      );

      final nearby = await repository
          .watchNearbyPlaces(
            latitude: 12.9716,
            longitude: 77.5946,
            radiusMeters: 250,
          )
          .first;

      expect(nearby.map((place) => place.id), contains('college-courtyard'));
      expect(nearby.map((place) => place.id), isNot(contains('far-place')));
    });
  });
}

Place _place({
  required String id,
  required double latitude,
  required DateTime now,
}) {
  return Place(
    id: id,
    name: id,
    latitude: latitude,
    longitude: 77.5946,
    geohash: Geohash.encode(latitude: latitude, longitude: 77.5946),
    custodianIds: const ['user-1'],
    aura: AuraZone.empty(now),
    memoryCount: 0,
    publicMemoryCount: 0,
    createdAt: now,
    updatedAt: now,
  );
}
