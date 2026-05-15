import 'package:echoes/features/aura/data/aura_history_entry_dto.dart';
import 'package:echoes/features/aura/domain/aura_history_entry.dart';
import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('AuraHistoryEntryDto round-trips between domain and map', () {
    final now = DateTime.utc(2026, 5, 15);
    final entry = AuraHistoryEntry(
      id: 'aura-history-1',
      placeId: 'place-1',
      aura: AuraZone(
        dominantSentiment: SentimentCategory.peaceful,
        compoundScore: 0.2,
        intensity: 0.4,
        memoryCount: 8,
        colorHex: AuraZone.colorHexFor(SentimentCategory.peaceful),
        updatedAt: now,
      ),
      recordedAt: now,
    );

    final map = AuraHistoryEntryDto.fromDomain(entry).toMap();
    final restored = AuraHistoryEntryDto.fromMap(entry.id, map).toDomain();

    expect(restored.id, entry.id);
    expect(restored.placeId, entry.placeId);
    expect(restored.aura.dominantSentiment, SentimentCategory.peaceful);
    expect(restored.aura.memoryCount, 8);
    expect(restored.recordedAt, now);
  });
}
