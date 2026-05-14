import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:echoes/features/places/data/place_dto.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('PlaceDto round-trips between domain and map', () {
    final now = DateTime.utc(2026, 5, 14, 12);
    final place = Place(
      id: 'place-1',
      name: 'College Courtyard',
      latitude: 12.9716,
      longitude: 77.5946,
      geohash: 'tdr1v',
      custodianIds: const ['user-1'],
      aura: AuraZone(
        dominantSentiment: SentimentCategory.positive,
        compoundScore: 0.7,
        intensity: 0.4,
        memoryCount: 3,
        colorHex: AuraZone.colorHexFor(SentimentCategory.positive),
        updatedAt: now,
      ),
      memoryCount: 3,
      publicMemoryCount: 2,
      createdAt: now,
      updatedAt: now,
    );

    final map = PlaceDto.fromDomain(place).toMap();
    final restored = PlaceDto.fromMap(place.id, map).toDomain();

    expect(restored.id, place.id);
    expect(restored.name, place.name);
    expect(restored.custodianIds, ['user-1']);
    expect(restored.aura.dominantSentiment, SentimentCategory.positive);
    expect(restored.memoryCount, 3);
  });
}
