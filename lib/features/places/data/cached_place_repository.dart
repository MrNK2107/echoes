import 'dart:math';

import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';

class CachedPlaceRepository implements PlaceRepository {
  CachedPlaceRepository(this._delegate, {this.maxNearbyQueries = 8});

  final PlaceRepository _delegate;
  final int maxNearbyQueries;
  final Map<String, Place> _placesById = {};
  final Map<_NearbyPlaceQuery, List<Place>> _nearbyPlaces = {};

  @override
  Future<void> create(Place place) async {
    await _delegate.create(place);
    _rememberPlace(place);
  }

  @override
  Future<Place?> findById(String id) async {
    final cached = _placesById[id];
    if (cached != null) {
      return cached;
    }

    final place = await _delegate.findById(id);
    if (place != null) {
      _rememberPlace(place);
    }
    return place;
  }

  @override
  Future<Place?> findNearestPlace({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) async {
    final nearest = await _delegate.findNearestPlace(
      latitude: latitude,
      longitude: longitude,
      radiusMeters: radiusMeters,
    );
    if (nearest != null) {
      _rememberPlace(nearest);
      return nearest;
    }

    return _nearestCachedPlace(
      latitude: latitude,
      longitude: longitude,
      radiusMeters: radiusMeters,
    );
  }

  @override
  Future<void> save(Place place) async {
    await _delegate.save(place);
    _rememberPlace(place);
  }

  @override
  Stream<List<Place>> watchNearbyPlaces({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) async* {
    final query = _NearbyPlaceQuery(
      latitude: latitude,
      longitude: longitude,
      radiusMeters: radiusMeters,
    );
    final cached = _nearbyPlaces[query];
    if (cached != null) {
      yield cached;
    }

    await for (final places in _delegate.watchNearbyPlaces(
      latitude: latitude,
      longitude: longitude,
      radiusMeters: radiusMeters,
    )) {
      final snapshot = List<Place>.unmodifiable(places);
      _rememberNearbyQuery(query, snapshot);
      for (final place in snapshot) {
        _rememberPlace(place);
      }
      yield snapshot;
    }
  }

  void _rememberPlace(Place place) {
    _placesById[place.id] = place;
  }

  void _rememberNearbyQuery(_NearbyPlaceQuery query, List<Place> places) {
    if (_nearbyPlaces.length >= maxNearbyQueries &&
        !_nearbyPlaces.containsKey(query)) {
      _nearbyPlaces.remove(_nearbyPlaces.keys.first);
    }
    _nearbyPlaces[query] = places;
  }

  Place? _nearestCachedPlace({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) {
    final matches =
        _placesById.values
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

    return matches.firstOrNull?.place;
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

class _NearbyPlaceQuery {
  _NearbyPlaceQuery({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) : latitude = (latitude * 10000).round(),
       longitude = (longitude * 10000).round(),
       radiusMeters = radiusMeters.round();

  final int latitude;
  final int longitude;
  final int radiusMeters;

  @override
  bool operator ==(Object other) {
    return other is _NearbyPlaceQuery &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.radiusMeters == radiusMeters;
  }

  @override
  int get hashCode => Object.hash(latitude, longitude, radiusMeters);
}
