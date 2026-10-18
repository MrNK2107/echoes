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

  /// Adds a [userId] as a custodian of the place identified by [placeId].
  Future<void> addCustodian({
    required String placeId,
    required String userId,
    required DateTime updatedAt,
  });

  /// Removes a [userId] from the custodians of the place identified by [placeId].
  Future<void> removeCustodian({
    required String placeId,
    required String userId,
    required DateTime updatedAt,
  });
}
