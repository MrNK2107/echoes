import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SentimentResult', () {
    test('classifies strongly positive text as positive', () {
      const sentiment = SentimentResult(
        compound: 0.72,
        positive: 0.8,
        neutral: 0.2,
        negative: 0,
      );

      expect(sentiment.category, SentimentCategory.positive);
    });

    test('classifies low positive text as peaceful', () {
      const sentiment = SentimentResult(
        compound: 0.2,
        positive: 0.25,
        neutral: 0.7,
        negative: 0.05,
      );

      expect(sentiment.category, SentimentCategory.peaceful);
    });

    test('classifies strong positive and negative distribution as mixed', () {
      const sentiment = SentimentResult(
        compound: 0.05,
        positive: 0.42,
        neutral: 0.1,
        negative: 0.48,
      );

      expect(sentiment.category, SentimentCategory.mixed);
    });

    test('classifies strongly negative text as heavy', () {
      const sentiment = SentimentResult(
        compound: -0.61,
        positive: 0.1,
        neutral: 0.2,
        negative: 0.7,
      );

      expect(sentiment.category, SentimentCategory.heavy);
    });
  });
}
