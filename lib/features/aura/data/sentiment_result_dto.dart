import 'package:echoes/features/aura/domain/sentiment_result.dart';

class SentimentResultDto {
  const SentimentResultDto({
    required this.compound,
    required this.positive,
    required this.neutral,
    required this.negative,
  });

  factory SentimentResultDto.fromDomain(SentimentResult sentiment) {
    return SentimentResultDto(
      compound: sentiment.compound,
      positive: sentiment.positive,
      neutral: sentiment.neutral,
      negative: sentiment.negative,
    );
  }

  factory SentimentResultDto.fromMap(Map<String, Object?> map) {
    return SentimentResultDto(
      compound: (map['compound']! as num).toDouble(),
      positive: (map['positive']! as num).toDouble(),
      neutral: (map['neutral']! as num).toDouble(),
      negative: (map['negative']! as num).toDouble(),
    );
  }

  final double compound;
  final double positive;
  final double neutral;
  final double negative;

  SentimentResult toDomain() {
    return SentimentResult(
      compound: compound,
      positive: positive,
      neutral: neutral,
      negative: negative,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'compound': compound,
      'positive': positive,
      'neutral': neutral,
      'negative': negative,
    };
  }
}
