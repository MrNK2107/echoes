import 'dart:math';

import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/features/ar/domain/ar_scene_place.dart';
import 'package:echoes/features/places/domain/place.dart';

class ArSceneMapper {
  const ArSceneMapper({
    this.maxPlaces = 5,
    this.maxOrbsPerPlace = 8,
    this.metersPerSceneUnit = 12,
    this.maxSceneDistance = 24,
  });

  final int maxPlaces;
  final int maxOrbsPerPlace;
  final double metersPerSceneUnit;
  final double maxSceneDistance;

  List<ArScenePlace> mapPlaces({
    required DeviceLocation origin,
    required List<Place> places,
  }) {
    final scenePlaces = places.map((place) {
      final offset = _offsetMeters(
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        latitude: place.latitude,
        longitude: place.longitude,
      );
      final east = offset.$1;
      final north = offset.$2;
      final distance = sqrt(east * east + north * north);
      final bearing = (_degrees(atan2(east, north)) + 360) % 360;
      final rawX = east / metersPerSceneUnit;
      final rawZ = -north / metersPerSceneUnit;
      final sceneDistance = sqrt(rawX * rawX + rawZ * rawZ);
      final scale = sceneDistance > maxSceneDistance
          ? maxSceneDistance / sceneDistance
          : 1.0;

      return ArScenePlace(
        place: place,
        eastMeters: east,
        northMeters: north,
        distanceMeters: distance,
        bearingDegrees: bearing,
        sceneX: rawX * scale,
        sceneZ: rawZ * scale,
        auraRadius: 1.8 + place.aura.intensity * 3.2,
        auraOpacity: 0.18 + place.aura.intensity * 0.32,
        visibleOrbCount: min(place.publicMemoryCount, maxOrbsPerPlace),
      );
    }).toList()..sort((a, b) => a.distanceMeters.compareTo(b.distanceMeters));

    return scenePlaces.take(maxPlaces).toList(growable: false);
  }

  (double eastMeters, double northMeters) _offsetMeters({
    required double originLatitude,
    required double originLongitude,
    required double latitude,
    required double longitude,
  }) {
    const earthRadiusMeters = 6371000.0;
    final originLatRad = _radians(originLatitude);
    final latRad = _radians(latitude);
    final deltaLat = latRad - originLatRad;
    final deltaLon = _radians(longitude - originLongitude);
    final averageLat = (originLatRad + latRad) / 2;

    final north = deltaLat * earthRadiusMeters;
    final east = deltaLon * earthRadiusMeters * cos(averageLat);
    return (east, north);
  }

  double _radians(double degrees) => degrees * pi / 180;

  double _degrees(double radians) => radians * 180 / pi;
}
