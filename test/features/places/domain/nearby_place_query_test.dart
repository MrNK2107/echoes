import 'package:echoes/features/places/domain/nearby_place_query.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('NearbyPlaceQuery', () {
    test('generates stable geohash query values from coordinates', () {
      final query = NearbyPlaceQuery.fromLocation(
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 1500,
      );

      expect(query.latitude, 12.9716);
      expect(query.longitude, 77.5946);
      expect(query.radiusMeters, 1500);
      expect(query.geohash, startsWith(query.geohashPrefix));
      expect(query.geohashPrefix, hasLength(5));
    });
  });
}
