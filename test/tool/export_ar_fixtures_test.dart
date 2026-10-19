import 'dart:convert';
import 'dart:io';

import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/features/ar/domain/ar_scene_mapper.dart';
import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:flutter_test/flutter_test.dart';

/// Generator (not a regression test): runs the real ArSceneMapper and writes
/// fixtures/domain/ar_scene.json for the TypeScript port.
final _now = DateTime.utc(2026, 10, 18, 9);

const _lat = 12.9716;
const _lng = 77.5946;

Map<String, Object?> _spec(
  String id,
  double lat,
  double lng, {
  double intensity = 0.5,
  int publicMemoryCount = 3,
}) => {
  'id': id,
  'latitude': lat,
  'longitude': lng,
  'intensity': intensity,
  'publicMemoryCount': publicMemoryCount,
};

Place _place(Map<String, Object?> s) {
  final lat = s['latitude']! as double;
  final lng = s['longitude']! as double;
  return Place(
    id: s['id']! as String,
    name: s['id']! as String,
    latitude: lat,
    longitude: lng,
    geohash: 'tdr1w',
    custodianIds: const [],
    aura: AuraZone(
      dominantSentiment: SentimentCategory.neutral,
      compoundScore: 0,
      intensity: s['intensity']! as double,
      memoryCount: 0,
      colorHex: '#888888',
      updatedAt: _now,
    ),
    memoryCount: s['publicMemoryCount']! as int,
    publicMemoryCount: s['publicMemoryCount']! as int,
    createdAt: _now,
    updatedAt: _now,
  );
}

void main() {
  test('export ar scene fixtures', () {
    const mapper = ArSceneMapper();
    // ~0.001 deg lat = 111 m.
    final raw = <MapEntry<String, List<Map<String, Object?>>>>[
      MapEntry('origin', [_spec('a', _lat, _lng)]),
      MapEntry('far 5km clamped', [_spec('a', _lat + 0.045, _lng)]),
      MapEntry('north', [_spec('a', _lat + 0.0005, _lng)]),
      MapEntry('south', [_spec('a', _lat - 0.0005, _lng)]),
      MapEntry('east', [_spec('a', _lat, _lng + 0.0005)]),
      MapEntry('west', [_spec('a', _lat, _lng - 0.0005)]),
      MapEntry('north-east', [_spec('a', _lat + 0.0004, _lng + 0.0004)]),
      MapEntry('south-west far', [_spec('a', _lat - 0.03, _lng - 0.03)]),
      MapEntry('intensity 0', [_spec('a', _lat + 0.001, _lng, intensity: 0)]),
      MapEntry('intensity 1', [_spec('a', _lat + 0.001, _lng, intensity: 1)]),
      MapEntry('publicMemoryCount 20 capped at 8', [
        _spec('a', _lat + 0.001, _lng, publicMemoryCount: 20),
      ]),
      MapEntry('publicMemoryCount 0', [
        _spec('a', _lat + 0.001, _lng, publicMemoryCount: 0),
      ]),
      MapEntry('8 places trimmed to 5 nearest, sorted', [
        for (var i = 0; i < 8; i++)
          _spec('p$i', _lat + (8 - i) * 0.0007, _lng + (i.isEven ? 0.0003 : -0.0003)),
      ]),
      MapEntry('no places', <Map<String, Object?>>[]),
      MapEntry('equal distances stable-ish', [
        _spec('a', _lat + 0.001, _lng),
        _spec('b', _lat + 0.002, _lng),
        _spec('c', _lat + 0.0015, _lng),
      ]),
    ];

    final cases = <Map<String, Object?>>[];
    for (final entry in raw) {
      final result = mapper.mapPlaces(
        origin: const DeviceLocation(
          latitude: _lat,
          longitude: _lng,
          accuracyMeters: 5,
        ),
        places: [for (final s in entry.value) _place(s)],
      );
      cases.add({
        'name': entry.key,
        'origin': {'latitude': _lat, 'longitude': _lng},
        'places': entry.value,
        'expected': [
          for (final r in result)
            {
              'placeId': r.place.id,
              'eastMeters': r.eastMeters,
              'northMeters': r.northMeters,
              'distanceMeters': r.distanceMeters,
              'bearingDegrees': r.bearingDegrees,
              'sceneX': r.sceneX,
              'sceneZ': r.sceneZ,
              'auraRadius': r.auraRadius,
              'auraOpacity': r.auraOpacity,
              'visibleOrbCount': r.visibleOrbCount,
            },
        ],
      });
    }
    expect(cases.length, greaterThanOrEqualTo(10));
    final dir = Directory('${Directory.current.path}/fixtures/domain');
    dir.createSync(recursive: true);
    File('${dir.path}/ar_scene.json').writeAsStringSync(
      '${const JsonEncoder.withIndent('  ').convert(cases)}\n',
    );
  });
}
