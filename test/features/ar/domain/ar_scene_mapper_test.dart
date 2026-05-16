import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/features/ar/domain/ar_scene_mapper.dart';
import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps nearby places into sorted relative AR scene positions', () {
    const mapper = ArSceneMapper(maxPlaces: 2, metersPerSceneUnit: 10);
    const origin = DeviceLocation(
      latitude: 12.9716,
      longitude: 77.5946,
      accuracyMeters: 8,
    );

    final scenePlaces = mapper.mapPlaces(
      origin: origin,
      places: [
        _place(id: 'far', latitude: 12.9760, longitude: 77.5946),
        _place(id: 'east', latitude: 12.9716, longitude: 77.5956),
        _place(id: 'north', latitude: 12.9721, longitude: 77.5946),
      ],
    );

    expect(scenePlaces, hasLength(2));
    expect(scenePlaces.first.place.id, 'north');
    expect(scenePlaces.first.northMeters, greaterThan(0));
    expect(scenePlaces.first.sceneZ, lessThan(0));
    expect(scenePlaces.last.place.id, 'east');
    expect(scenePlaces.last.eastMeters, greaterThan(0));
    expect(scenePlaces.last.sceneX, greaterThan(0));
  });

  test('caps far places to the configured scene distance', () {
    const mapper = ArSceneMapper(maxSceneDistance: 3, metersPerSceneUnit: 1);
    const origin = DeviceLocation(
      latitude: 12.9716,
      longitude: 77.5946,
      accuracyMeters: 8,
    );

    final scenePlace = mapper
        .mapPlaces(
          origin: origin,
          places: [_place(id: 'far', latitude: 13.0716, longitude: 77.5946)],
        )
        .single;

    expect(scenePlace.sceneX.abs(), lessThanOrEqualTo(3));
    expect(scenePlace.sceneZ.abs(), lessThanOrEqualTo(3));
  });
}

Place _place({
  required String id,
  required double latitude,
  required double longitude,
}) {
  final now = DateTime.utc(2026, 5, 16);
  return Place(
    id: id,
    name: id,
    latitude: latitude,
    longitude: longitude,
    geohash: 'tdr1v',
    custodianIds: const ['user-1'],
    aura: AuraZone.empty(now),
    memoryCount: 1,
    publicMemoryCount: 1,
    createdAt: now,
    updatedAt: now,
  );
}
