import 'package:echoes/features/aura/domain/sentiment_result.dart';

abstract interface class SentimentAnalyzer {
  SentimentResult analyze(String text);
}
