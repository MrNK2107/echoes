import 'dart:math';

import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:echoes/features/memories/domain/memory.dart';

class AuraCalculator {
  AuraZone calculate({required List<Memory> memories, required DateTime now}) {
    final publicMemories = memories
        .where((memory) => !memory.isDeleted)
        .toList();
    if (publicMemories.isEmpty) {
      return AuraZone.empty(now);
    }

    var weightedTotal = 0.0;
    var totalWeight = 0.0;
    var positiveCount = 0;
    var negativeCount = 0;

    for (final memory in publicMemories) {
      final ageDays = max(now.difference(memory.createdAt).inDays, 0);
      final weight = 1 / (1 + ageDays / 30);
      weightedTotal += memory.sentiment.compound * weight;
      totalWeight += weight;

      if (memory.sentiment.compound >= 0.1) {
        positiveCount++;
      }
      if (memory.sentiment.compound <= -0.1) {
        negativeCount++;
      }
    }

    final score = totalWeight == 0 ? 0.0 : weightedTotal / totalWeight;
    final sentiment = _dominantSentiment(
      score: score,
      positiveCount: positiveCount,
      negativeCount: negativeCount,
    );

    return AuraZone(
      dominantSentiment: sentiment,
      compoundScore: score.clamp(-1.0, 1.0),
      intensity: min(publicMemories.length / 20, 1),
      memoryCount: publicMemories.length,
      colorHex: AuraZone.colorHexFor(sentiment),
      updatedAt: now,
    );
  }

  SentimentCategory _dominantSentiment({
    required double score,
    required int positiveCount,
    required int negativeCount,
  }) {
    if (positiveCount > 0 && negativeCount > 0) {
      return SentimentCategory.mixed;
    }
    if (score >= 0.35) {
      return SentimentCategory.positive;
    }
    if (score >= 0.1) {
      return SentimentCategory.peaceful;
    }
    if (score <= -0.35) {
      return SentimentCategory.heavy;
    }
    return SentimentCategory.neutral;
  }
}
