import 'dart:convert';
import 'dart:io';

import 'package:echoes/core/geo/geohash.dart';
import 'package:echoes/features/aura/data/lexicon_sentiment_analyzer.dart';
import 'package:echoes/features/aura/domain/aura_calculator.dart';
import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/places/domain/nearby_place_query.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter_test/flutter_test.dart';

/// Generator (not a regression test): runs the real Dart domain code and
/// writes golden fixtures to fixtures/domain/ for the TypeScript ports.
final _now = DateTime.utc(2026, 10, 18, 9);

String _iso(DateTime d) => d.toUtc().toIso8601String();

void _write(String name, List<Map<String, Object?>> cases, int minCases) {
  expect(cases.length, greaterThanOrEqualTo(minCases), reason: name);
  final dir = Directory('${Directory.current.path}/fixtures/domain');
  dir.createSync(recursive: true);
  File('${dir.path}/$name.json').writeAsStringSync(
    '${const JsonEncoder.withIndent('  ').convert(cases)}\n',
  );
}

Memory _memory({
  String userId = 'author',
  PrivacyType privacy = PrivacyType.public,
  List<String> taggedUserIds = const [],
  DateTime? releaseDate,
  bool isDeleted = false,
  double compound = 0,
  DateTime? createdAt,
}) {
  return Memory(
    id: 'm1',
    userId: userId,
    placeId: 'p1',
    textContent: 'x',
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: 'tdr1w',
    sentiment: SentimentResult(
      compound: compound,
      positive: 0,
      neutral: 1,
      negative: 0,
    ),
    privacy: privacy,
    taggedUserIds: taggedUserIds,
    isDeleted: isDeleted,
    createdAt: createdAt ?? _now,
    updatedAt: createdAt ?? _now,
    releaseDate: releaseDate,
  );
}

void main() {
  test('export sentiment fixtures', () {
    final analyzer = LexiconSentimentAnalyzer();
    final texts = <String>[
      'happy', 'good', 'wonderful day', 'I love this place', 'so beautiful',
      'sad', 'bad', 'terrible experience', 'I hate this', 'awful and painful',
      'not happy', 'never good', 'not bad', 'never sad', 'is not good',
      'very good', 'extremely sad', 'slightly bad', 'really happy',
      'extremely wonderful', 'slightly good',
      'good but sad', 'sad but beautiful', 'happy but tired',
      'bad but ultimately wonderful',
      'GREAT', 'TERRIBLE', 'I AM SO HAPPY', 'This is AWFUL',
      'great!!!', 'terrible!!!', 'good!', 'what a day!!!',
      '🎉🎉', '😢', '   ', 'the table is brown', 'I went to the market',
      'happy and heartbroken', 'joyful yet miserable',
      'bahut khushi, so happy', 'bahut dukh, so sad', 'mast place hai',
      'peaceful calm quiet', 'a bit nice', 'okay',
      'love love love love love', 'hate hate hate hate hate',
      'good not happy', 'love not nice', 'great never kind',
      'happy good sad bad', 'love joy hate pain', 'wonderful great awful terrible',
      'x' * 2000, 'happy ' * 333,
    ];
    final cases = <Map<String, Object?>>[];
    for (final t in texts) {
      final r = analyzer.analyze(t);
      cases.add({
        'text': t,
        'compound': r.compound,
        'positive': r.positive,
        'neutral': r.neutral,
        'negative': r.negative,
        'category': r.category.name,
      });
    }
    final counts = <String, int>{};
    for (final c in cases) {
      counts.update(c['category']! as String, (v) => v + 1, ifAbsent: () => 1);
    }
    for (final cat in ['positive', 'peaceful', 'neutral', 'mixed', 'heavy']) {
      expect(counts[cat] ?? 0, greaterThanOrEqualTo(3), reason: cat);
    }
    _write('sentiment', cases, 40);
  });

  test('export geohash fixtures', () {
    final points = <List<double>>[
      [12.9716, 77.5946],
      [28.6139, 77.2090],
      [19.0760, 72.8777],
      [0, 0],
      [-33.8688, 151.2093],
      [89.9, 179.9],
      [-89.9, -179.9],
    ];
    final cases = <Map<String, Object?>>[];
    for (final p in points) {
      for (final precision in [5, 7, 9]) {
        cases.add({
          'latitude': p[0],
          'longitude': p[1],
          'precision': precision,
          'hash': Geohash.encode(
            latitude: p[0],
            longitude: p[1],
            precision: precision,
          ),
        });
      }
    }
    _write('geohash', cases, 12);
  });

  test('export nearby fixtures', () {
    const lat = 12.9716;
    const lng = 77.5946;
    final cases = <Map<String, Object?>>[];
    for (final r in [50.0, 100.0, 101.0, 500.0, 1500.0, 4000.0, 4001.0, 20000.0]) {
      cases.add({
        'latitude': lat,
        'longitude': lng,
        'radiusMeters': r,
        'precision': NearbyPlaceQuery.geohashPrecisionFor(r),
        'prefixes': NearbyPlaceQuery.queryPrefixes(
          latitude: lat,
          longitude: lng,
          radiusMeters: r,
        ),
      });
    }
    _write('nearby', cases, 8);
  });

  test('export aura fixtures', () {
    final calc = AuraCalculator();
    const hour = Duration(hours: 1);
    final raw = <MapEntry<String, List<Memory>>>[
      const MapEntry('empty', <Memory>[]),
      MapEntry('one positive today', [_memory(compound: 0.8)]),
      MapEntry('one heavy 90 days old', [
        _memory(
          compound: -0.8,
          createdAt: _now.subtract(const Duration(days: 90)),
        ),
      ]),
      MapEntry('positive plus negative is mixed', [
        _memory(compound: 0.7),
        _memory(compound: -0.7),
      ]),
      MapEntry('deleted only is empty', [
        _memory(compound: 0.9, isDeleted: true),
      ]),
      MapEntry('25 neutral intensity capped at 1', [
        for (var i = 0; i < 25; i++) _memory(compound: 0),
      ]),
      MapEntry('deleted ignored among live', [
        _memory(compound: 0.5),
        _memory(compound: -0.9, isDeleted: true),
      ]),
      MapEntry('future createdAt clamps age to 0', [
        _memory(compound: 0.6, createdAt: _now.add(const Duration(days: 3))),
      ]),
    ];
    final ages = <String, Duration>{
      'age 0 days': Duration.zero,
      'age 29 days': const Duration(days: 29),
      'age 30 days minus 1 hour': const Duration(days: 30) - hour,
      'age 30 days': const Duration(days: 30),
      'age 30 days plus 1 hour': const Duration(days: 30) + hour,
      'age 31 days': const Duration(days: 31),
      'age 365 days': const Duration(days: 365),
      'age 365 days minus 1 hour': const Duration(days: 365) - hour,
    };
    ages.forEach((name, age) {
      raw.add(
        MapEntry(name, [
          _memory(compound: 0.9, createdAt: _now.subtract(age)),
          _memory(compound: 0.2, createdAt: _now),
        ]),
      );
    });
    for (final c in [0.1, 0.35, -0.35, -0.1, 0.0, 0.34, -0.34]) {
      raw.add(MapEntry('single compound $c', [_memory(compound: c)]));
    }

    final cases = <Map<String, Object?>>[];
    for (final entry in raw) {
      final memories = entry.value;
      final z = calc.calculate(memories: memories, now: _now);
      cases.add({
        'name': entry.key,
        'now': _iso(_now),
        'memories': [
          for (final m in memories)
            {
              'compound': m.sentiment.compound,
              'createdAt': _iso(m.createdAt),
              'isDeleted': m.isDeleted,
            },
        ],
        'expected': {
          'dominantSentiment': z.dominantSentiment.name,
          'compoundScore': z.compoundScore,
          'intensity': z.intensity,
          'memoryCount': z.memoryCount,
          'colorHex': z.colorHex,
        },
      });
    }
    _write('aura', cases, 10);
  });

  test('export visibility fixtures', () {
    final cases = <Map<String, Object?>>[];
    void add(
      String name,
      Memory m, {
      String viewerId = 'stranger',
      bool member = false,
    }) {
      cases.add({
        'name': name,
        'memory': {
          'userId': m.userId,
          'privacy': m.privacy.name,
          'taggedUserIds': m.taggedUserIds,
          'releaseDate': m.releaseDate == null ? null : _iso(m.releaseDate!),
          'isDeleted': m.isDeleted,
        },
        'viewerId': viewerId,
        'viewerIsCommunityMember': member,
        'now': _iso(_now),
        'visible': m.isVisibleTo(
          viewerId: viewerId,
          viewerIsCommunityMember: member,
          now: _now,
        ),
      });
    }

    for (final p in PrivacyType.values) {
      final m = _memory(
        privacy: p,
        taggedUserIds: const ['friend'],
        releaseDate: _now.subtract(const Duration(days: 1)),
      );
      add('${p.name} author', m, viewerId: 'author');
      add('${p.name} stranger', m);
    }
    final tagged = _memory(
      privacy: PrivacyType.tagged,
      taggedUserIds: const ['friend'],
    );
    add('tagged viewer is tagged', tagged, viewerId: 'friend');
    add('tagged viewer not tagged', tagged, viewerId: 'other');
    add(
      'tagged with empty list',
      _memory(privacy: PrivacyType.tagged),
      viewerId: 'friend',
    );
    add(
      'timeRelease releaseDate equals now',
      _memory(privacy: PrivacyType.timeRelease, releaseDate: _now),
    );
    add(
      'timeRelease releaseDate now minus 1ms',
      _memory(
        privacy: PrivacyType.timeRelease,
        releaseDate: _now.subtract(const Duration(milliseconds: 1)),
      ),
    );
    add(
      'timeRelease releaseDate now plus 1ms',
      _memory(
        privacy: PrivacyType.timeRelease,
        releaseDate: _now.add(const Duration(milliseconds: 1)),
      ),
    );
    add(
      'timeRelease null releaseDate',
      _memory(privacy: PrivacyType.timeRelease),
    );
    add(
      'timeRelease future but author',
      _memory(
        privacy: PrivacyType.timeRelease,
        releaseDate: _now.add(const Duration(days: 5)),
      ),
      viewerId: 'author',
    );
    final community = _memory(privacy: PrivacyType.community);
    add('community member', community, member: true);
    add('community non-member', community);
    add('public deleted author', _memory(isDeleted: true), viewerId: 'author');
    add('public deleted stranger', _memory(isDeleted: true));
    _write('visibility', cases, 14);
  });
}
