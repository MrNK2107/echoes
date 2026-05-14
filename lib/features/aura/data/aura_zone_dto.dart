import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';

class AuraZoneDto {
  const AuraZoneDto({
    required this.dominantSentiment,
    required this.compoundScore,
    required this.intensity,
    required this.memoryCount,
    required this.colorHex,
    required this.updatedAt,
  });

  factory AuraZoneDto.fromDomain(AuraZone aura) {
    return AuraZoneDto(
      dominantSentiment: aura.dominantSentiment.name,
      compoundScore: aura.compoundScore,
      intensity: aura.intensity,
      memoryCount: aura.memoryCount,
      colorHex: aura.colorHex,
      updatedAt: aura.updatedAt,
    );
  }

  factory AuraZoneDto.fromMap(Map<String, Object?> map) {
    return AuraZoneDto(
      dominantSentiment: map['dominantSentiment']! as String,
      compoundScore: (map['compoundScore']! as num).toDouble(),
      intensity: (map['intensity']! as num).toDouble(),
      memoryCount: map['memoryCount']! as int,
      colorHex: map['colorHex']! as String,
      updatedAt: DateTime.parse(map['updatedAt']! as String),
    );
  }

  final String dominantSentiment;
  final double compoundScore;
  final double intensity;
  final int memoryCount;
  final String colorHex;
  final DateTime updatedAt;

  AuraZone toDomain() {
    return AuraZone(
      dominantSentiment: SentimentCategory.values.byName(dominantSentiment),
      compoundScore: compoundScore,
      intensity: intensity,
      memoryCount: memoryCount,
      colorHex: colorHex,
      updatedAt: updatedAt,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'dominantSentiment': dominantSentiment,
      'compoundScore': compoundScore,
      'intensity': intensity,
      'memoryCount': memoryCount,
      'colorHex': colorHex,
      'updatedAt': updatedAt.toUtc().toIso8601String(),
    };
  }
}
