import 'package:echoes/app/theme.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:flutter/material.dart';

class AuraZone {
  const AuraZone({
    required this.dominantSentiment,
    required this.compoundScore,
    required this.intensity,
    required this.memoryCount,
    required this.colorHex,
    required this.updatedAt,
  }) : assert(compoundScore >= -1 && compoundScore <= 1),
       assert(intensity >= 0 && intensity <= 1),
       assert(memoryCount >= 0);

  factory AuraZone.empty(DateTime updatedAt) {
    return AuraZone(
      dominantSentiment: SentimentCategory.neutral,
      compoundScore: 0,
      intensity: 0,
      memoryCount: 0,
      colorHex: colorHexFor(SentimentCategory.neutral),
      updatedAt: updatedAt,
    );
  }

  final SentimentCategory dominantSentiment;
  final double compoundScore;
  final double intensity;
  final int memoryCount;
  final String colorHex;
  final DateTime updatedAt;

  Color get color => Color(int.parse('0xFF${colorHex.substring(1)}'));

  static String colorHexFor(SentimentCategory category) {
    return switch (category) {
      SentimentCategory.positive => _toHex(EchoesColors.positiveAura),
      SentimentCategory.peaceful => _toHex(EchoesColors.peacefulAura),
      SentimentCategory.heavy => _toHex(EchoesColors.heavyAura),
      SentimentCategory.mixed => _toHex(EchoesColors.mixedAura),
      SentimentCategory.neutral => _toHex(EchoesColors.neutralAura),
    };
  }

  static String _toHex(Color color) {
    final value = color.toARGB32() & 0xFFFFFF;
    return '#${value.toRadixString(16).padLeft(6, '0').toUpperCase()}';
  }
}
