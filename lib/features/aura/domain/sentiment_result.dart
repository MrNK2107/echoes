import 'package:echoes/features/aura/domain/sentiment_category.dart';

class SentimentResult {
  const SentimentResult({
    required this.compound,
    required this.positive,
    required this.neutral,
    required this.negative,
  }) : assert(compound >= -1 && compound <= 1),
       assert(positive >= 0 && positive <= 1),
       assert(neutral >= 0 && neutral <= 1),
       assert(negative >= 0 && negative <= 1);

  final double compound;
  final double positive;
  final double neutral;
  final double negative;

  SentimentCategory get category {
    final hasStrongPositive = positive >= 0.35;
    final hasStrongNegative = negative >= 0.35;

    if (hasStrongPositive && hasStrongNegative) {
      return SentimentCategory.mixed;
    }
    if (compound >= 0.35) {
      return SentimentCategory.positive;
    }
    if (compound >= 0.1) {
      return SentimentCategory.peaceful;
    }
    if (compound <= -0.35) {
      return SentimentCategory.heavy;
    }
    return SentimentCategory.neutral;
  }
}
