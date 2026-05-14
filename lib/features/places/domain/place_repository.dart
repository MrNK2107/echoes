import 'package:echoes/features/places/domain/place.dart';

abstract interface class PlaceRepository {
  Stream<List<Place>> watchNearbyPlaces({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  });

  Future<Place?> findById(String id);

  Future<Place?> findNearestPlace({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  });

  Future<void> create(Place place);

  Future<void> save(Place place);
}
