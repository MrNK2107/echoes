import 'dart:async';

import 'package:echoes/core/geo/geohash.dart';
import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/places/data/cached_place_repository.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CachedPlaceRepository', () {
    test('replays cached nearby places before fresh stream values', () async {
      final delegate = _FakePlaceRepository();
      final repository = CachedPlaceRepository(delegate);
      final now = DateTime.utc(2026, 5, 17);
      final cached = _place(id: 'cached', now: now);
      final fresh = _place(id: 'fresh', now: now);

      final first = repository.watchNearbyPlaces(
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 250,
      );
      final firstExpectation = expectLater(
        first,
        emits(_placeIds(const ['cached'])),
      );
      await Future<void>.delayed(Duration.zero);
      delegate.emit([cached]);
      await firstExpectation;

      final second = repository.watchNearbyPlaces(
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 250,
      );

      final freshExpectation = expectLater(
        second,
        emitsInOrder([
          _placeIds(const ['cached']),
          _placeIds(const ['fresh']),
        ]),
      );
      await Future<void>.delayed(Duration.zero);
      delegate.emit([fresh]);
      await freshExpectation;
      await delegate.dispose();
    });

    test('findById uses remembered places without querying delegate', () async {
      final delegate = _FakePlaceRepository();
      final repository = CachedPlaceRepository(delegate);
      final place = _place(id: 'remembered', now: DateTime.utc(2026, 5, 17));

      await repository.save(place);

      expect(await repository.findById(place.id), place);
      expect(delegate.findByIdCalls, isZero);
      await delegate.dispose();
    });
  });
}

class _FakePlaceRepository implements PlaceRepository {
  final _controller = StreamController<List<Place>>.broadcast();
  final Map<String, Place> saved = {};
  int findByIdCalls = 0;

  void emit(List<Place> places) {
    _controller.add(places);
  }

  Future<void> dispose() => _controller.close();

  @override
  Future<void> create(Place place) async {
    saved[place.id] = place;
  }

  @override
  Future<Place?> findById(String id) async {
    findByIdCalls++;
    return saved[id];
  }

  @override
  Future<Place?> findNearestPlace({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) async {
    return null;
  }

  @override
  Future<void> save(Place place) async {
    saved[place.id] = place;
  }

  @override
  Stream<List<Place>> watchNearbyPlaces({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) {
    return _controller.stream;
  }
}

Place _place({required String id, required DateTime now}) {
  return Place(
    id: id,
    name: id,
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: Geohash.encode(latitude: 12.9716, longitude: 77.5946),
    custodianIds: const ['user-1'],
    aura: AuraZone.empty(now),
    memoryCount: 0,
    publicMemoryCount: 0,
    createdAt: now,
    updatedAt: now,
  );
}

Matcher _placeIds(List<String> ids) {
  return predicate<List<Place>>((places) {
    final actualIds = places.map((place) => place.id).toList();
    return _sameIds(actualIds, ids);
  }, 'places with ids $ids');
}

bool _sameIds(List<String> actual, List<String> expected) {
  if (actual.length != expected.length) {
    return false;
  }
  for (var index = 0; index < actual.length; index++) {
    if (actual[index] != expected[index]) {
      return false;
    }
  }
  return true;
}
