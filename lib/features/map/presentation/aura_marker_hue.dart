import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class AuraMarkerHue {
  const AuraMarkerHue._();

  static double fromColorHex(String colorHex) {
    return switch (colorHex.toUpperCase()) {
      '#FFB347' => BitmapDescriptor.hueYellow,
      '#77B5FE' => BitmapDescriptor.hueAzure,
      '#9B59B6' => BitmapDescriptor.hueViolet,
      '#DDA0DD' => BitmapDescriptor.hueMagenta,
      '#C0C0C0' => BitmapDescriptor.hueRose,
      _ => BitmapDescriptor.hueRose,
    };
  }

  static double fromAura(AuraZone aura) => fromColorHex(aura.colorHex);

  static double fromSentiment(SentimentCategory sentiment) {
    return fromColorHex(AuraZone.colorHexFor(sentiment));
  }
}
