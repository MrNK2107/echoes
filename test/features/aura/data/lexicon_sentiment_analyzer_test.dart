import 'package:echoes/features/aura/data/lexicon_sentiment_analyzer.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LexiconSentimentAnalyzer', () {
    test('detects positive memory text', () {
      final sentiment = LexiconSentimentAnalyzer().analyze(
        'A beautiful warm happy farewell with friends',
      );

      expect(sentiment.compound, greaterThan(0));
      expect(sentiment.category, SentimentCategory.positive);
    });

    test('detects heavy memory text', () {
      final sentiment = LexiconSentimentAnalyzer().analyze(
        'A sad lonely dark and difficult day',
      );

      expect(sentiment.compound, lessThan(0));
      expect(sentiment.category, SentimentCategory.heavy);
    });

    test('returns deterministic neutral scores for empty text', () {
      final sentiment = LexiconSentimentAnalyzer().analyze('   ');

      expect(sentiment.compound, 0);
      expect(sentiment.positive, 0);
      expect(sentiment.neutral, 1);
      expect(sentiment.negative, 0);
      expect(sentiment.category, SentimentCategory.neutral);
    });

    test('normalizes case and punctuation deterministically', () {
      final sentiment = LexiconSentimentAnalyzer().analyze(
        'LOVE, warm; unknown.',
      );

      expect(sentiment.compound, closeTo(2 / 3, 0.0001));
      expect(sentiment.positive, closeTo(2 / 3, 0.0001));
      expect(sentiment.neutral, closeTo(1 / 3, 0.0001));
      expect(sentiment.negative, 0);
      expect(sentiment.category, SentimentCategory.positive);
    });

    test('classifies balanced positive and negative words as mixed', () {
      final sentiment = LexiconSentimentAnalyzer().analyze('love joy sad dark');

      expect(sentiment.compound, 0);
      expect(sentiment.positive, 0.5);
      expect(sentiment.neutral, 0);
      expect(sentiment.negative, 0.5);
      expect(sentiment.category, SentimentCategory.mixed);
    });
  });
}
