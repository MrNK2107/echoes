import 'dart:async';
import 'dart:math';

import 'package:echoes/core/geo/geohash.dart';
import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';

class LocalPlaceRepository implements PlaceRepository {
  LocalPlaceRepository({DateTime? now})
    : _places = _seedPlaces(now ?? DateTime.now().toUtc());

  final List<Place> _places;

  @override
  Future<void> create(Place place) async {
    _places.add(place);
  }

  @override
  Future<Place?> findById(String id) async {
    return _places.where((place) => place.id == id).firstOrNull;
  }

  @override
  Future<Place?> findNearestPlace({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) async {
    final nearby =
        _places
            .map(
              (place) => (
                place: place,
                distance: _distanceMeters(
                  latitude,
                  longitude,
                  place.latitude,
                  place.longitude,
                ),
              ),
            )
            .where((entry) => entry.distance <= radiusMeters)
            .toList()
          ..sort((a, b) => a.distance.compareTo(b.distance));

    return nearby.firstOrNull?.place;
  }

  @override
  Future<void> save(Place place) async {
    final index = _places.indexWhere((current) => current.id == place.id);
    if (index == -1) {
      _places.add(place);
    } else {
      _places[index] = place;
    }
  }

  @override
  Stream<List<Place>> watchNearbyPlaces({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) {
    final nearby = _places.where((place) {
      return _distanceMeters(
            latitude,
            longitude,
            place.latitude,
            place.longitude,
          ) <=
          radiusMeters;
    }).toList();

    return Stream.value(nearby);
  }

  static List<Place> _seedPlaces(DateTime now) {
    return [
      _place(
        id: 'cubbon-park',
        name: 'Cubbon Park',
        latitude: 12.9763,
        longitude: 77.5929,
        sentiment: SentimentCategory.peaceful,
        memoryCount: 18,
        now: now,
      ),
      _place(
        id: 'college-courtyard',
        name: 'College Courtyard',
        latitude: 12.9716,
        longitude: 77.5946,
        sentiment: SentimentCategory.positive,
        memoryCount: 7,
        now: now,
      ),
      _place(
        id: 'old-cafe',
        name: 'Old Cafe',
        latitude: 12.9702,
        longitude: 77.5918,
        sentiment: SentimentCategory.mixed,
        memoryCount: 5,
        now: now,
      ),
    ];
  }

  static Place _place({
    required String id,
    required String name,
    required double latitude,
    required double longitude,
    required SentimentCategory sentiment,
    required int memoryCount,
    required DateTime now,
  }) {
    return Place(
      id: id,
      name: name,
      latitude: latitude,
      longitude: longitude,
      geohash: Geohash.encode(latitude: latitude, longitude: longitude),
      custodianIds: const ['local-custodian'],
      aura: AuraZone(
        dominantSentiment: sentiment,
        compoundScore: switch (sentiment) {
          SentimentCategory.positive => 0.68,
          SentimentCategory.peaceful => 0.24,
          SentimentCategory.neutral => 0,
          SentimentCategory.mixed => 0.04,
          SentimentCategory.heavy => -0.55,
        },
        intensity: min(memoryCount / 20, 1),
        memoryCount: memoryCount,
        colorHex: AuraZone.colorHexFor(sentiment),
        updatedAt: now,
      ),
      memoryCount: memoryCount,
      publicMemoryCount: memoryCount,
      createdAt: now,
      updatedAt: now,
    );
  }

  static double _distanceMeters(
    double startLatitude,
    double startLongitude,
    double endLatitude,
    double endLongitude,
  ) {
    const earthRadiusMeters = 6371000;
    final dLat = _degreesToRadians(endLatitude - startLatitude);
    final dLon = _degreesToRadians(endLongitude - startLongitude);
    final lat1 = _degreesToRadians(startLatitude);
    final lat2 = _degreesToRadians(endLatitude);

    final a =
        sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadiusMeters * c;
  }

  static double _degreesToRadians(double degrees) => degrees * pi / 180;
}
