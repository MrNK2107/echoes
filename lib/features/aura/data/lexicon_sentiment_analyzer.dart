import 'package:echoes/features/aura/domain/sentiment_analyzer.dart';
import 'package:echoes/features/aura/domain/sentiment_result.dart';

class LexiconSentimentAnalyzer implements SentimentAnalyzer {
  static const _positiveWords = {
    'beautiful',
    'calm',
    'celebrate',
    'farewell',
    'favorite',
    'friend',
    'glow',
    'glowing',
    'happy',
    'hope',
    'joy',
    'love',
    'peace',
    'peaceful',
    'warm',
    'wonderful',
  };

  static const _negativeWords = {
    'alone',
    'angry',
    'cry',
    'dark',
    'difficult',
    'fear',
    'heavy',
    'hurt',
    'lonely',
    'lost',
    'sad',
    'sorrow',
    'tired',
  };

  @override
  SentimentResult analyze(String text) {
    final words = text
        .toLowerCase()
        .split(RegExp(r'[^a-z]+'))
        .where((word) => word.isNotEmpty)
        .toList();

    if (words.isEmpty) {
      return const SentimentResult(
        compound: 0,
        positive: 0,
        neutral: 1,
        negative: 0,
      );
    }

    final positive = words.where(_positiveWords.contains).length;
    final negative = words.where(_negativeWords.contains).length;
    final scored = positive + negative;
    final neutral = (words.length - scored).clamp(0, words.length);
    final compound = ((positive - negative) / words.length).clamp(-1.0, 1.0);

    return SentimentResult(
      compound: compound,
      positive: positive / words.length,
      neutral: neutral / words.length,
      negative: negative / words.length,
    );
  }
}
