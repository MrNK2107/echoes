import 'package:echoes/features/aura/domain/aura_calculator.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AuraCalculator', () {
    test('calculates positive aura from public memories', () {
      final now = DateTime.utc(2026, 5, 14);
      final aura = AuraCalculator().calculate(
        memories: [
          _memory(compound: 0.8, createdAt: now),
          _memory(
            compound: 0.6,
            createdAt: now.subtract(const Duration(days: 10)),
          ),
        ],
        now: now,
      );

      expect(aura.dominantSentiment, SentimentCategory.positive);
      expect(aura.memoryCount, 2);
      expect(aura.intensity, 0.1);
    });
  });
}

Memory _memory({required double compound, required DateTime createdAt}) {
  return Memory(
    id: 'memory-$compound',
    userId: 'user-1',
    placeId: 'place-1',
    textContent: 'Memory',
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: 'tdr1v',
    sentiment: SentimentResult(
      compound: compound,
      positive: compound > 0 ? compound : 0,
      neutral: 0,
      negative: compound < 0 ? compound.abs() : 0,
    ),
    privacy: PrivacyType.public,
    taggedUserIds: const [],
    isDeleted: false,
    createdAt: createdAt,
    updatedAt: createdAt,
  );
}
