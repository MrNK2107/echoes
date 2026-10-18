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

      // 2 positive words (love, warm), 1 non-sentiment word (unknown)
      // compound = (2 - 0) / (2 + 0) = 1.0
      expect(sentiment.compound, closeTo(1.0, 0.0001));
      // positive = 2 / (2 + 0 + 1) = 0.666
      expect(sentiment.positive, closeTo(2 / 3, 0.0001));
      expect(sentiment.negative, 0);
      expect(sentiment.category, SentimentCategory.positive);
    });

    test('classifies balanced positive and negative words as mixed', () {
      final sentiment = LexiconSentimentAnalyzer().analyze('love joy sad dark');

      // 2 positive, 2 negative → compound = 0 → mixed
      expect(sentiment.compound, 0);
      // positive = 2 / (2 + 2 + 1) = 0.4
      expect(sentiment.positive, closeTo(0.4, 0.0001));
      // negative = 2 / (2 + 2 + 1) = 0.4
      expect(sentiment.negative, closeTo(0.4, 0.0001));
      expect(sentiment.category, SentimentCategory.mixed);
    });

    test('handles negation correctly', () {
      final sentiment = LexiconSentimentAnalyzer().analyze('not happy');

      expect(sentiment.compound, lessThan(0));
      expect(sentiment.category, SentimentCategory.heavy);
    });

    test('handles intensifiers', () {
      // With only positive words, compound is always 1.0 regardless of intensity.
      // Instead, check that the positive proportion is higher with intensifier.
      final simpleSentiment = LexiconSentimentAnalyzer().analyze('good');
      final intensifiedSentiment = LexiconSentimentAnalyzer().analyze(
        'very good',
      );

      // Without intensifier: totalPositive=1, positive=1/(1+0+1)=0.5
      // With intensifier: totalPositive=1.35, positive=1.35/(1.35+0+1)≈0.574
      expect(intensifiedSentiment.positive, greaterThan(simpleSentiment.positive));
    });
  });
}
