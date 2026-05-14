import 'package:echoes/core/geo/geohash.dart';

class NearbyPlaceQuery {
  const NearbyPlaceQuery({
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    required this.geohash,
    required this.geohashPrefix,
  });

  factory NearbyPlaceQuery.fromLocation({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) {
    final geohash = Geohash.encode(latitude: latitude, longitude: longitude);

    return NearbyPlaceQuery(
      latitude: latitude,
      longitude: longitude,
      radiusMeters: radiusMeters,
      geohash: geohash,
      geohashPrefix: geohash.substring(0, 5),
    );
  }

  final double latitude;
  final double longitude;
  final double radiusMeters;
  final String geohash;
  final String geohashPrefix;
}
