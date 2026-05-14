import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AuraZone', () {
    test('creates neutral empty aura', () {
      final now = DateTime.utc(2026, 5, 14);
      final aura = AuraZone.empty(now);

      expect(aura.dominantSentiment, SentimentCategory.neutral);
      expect(aura.compoundScore, 0);
      expect(aura.intensity, 0);
      expect(aura.memoryCount, 0);
      expect(aura.colorHex, '#C0C0C0');
      expect(aura.updatedAt, now);
    });

    test('maps positive aura to warm gold', () {
      expect(AuraZone.colorHexFor(SentimentCategory.positive), '#FFB347');
    });
  });
}
