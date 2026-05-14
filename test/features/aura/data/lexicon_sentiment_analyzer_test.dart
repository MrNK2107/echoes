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
  });
}
