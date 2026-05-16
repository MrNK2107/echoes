import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:echoes/features/map/presentation/aura_marker_hue.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

void main() {
  test('maps aura sentiment colors to Google marker hues', () {
    expect(
      AuraMarkerHue.fromSentiment(SentimentCategory.positive),
      BitmapDescriptor.hueYellow,
    );
    expect(
      AuraMarkerHue.fromSentiment(SentimentCategory.peaceful),
      BitmapDescriptor.hueAzure,
    );
    expect(
      AuraMarkerHue.fromSentiment(SentimentCategory.heavy),
      BitmapDescriptor.hueViolet,
    );
    expect(
      AuraMarkerHue.fromSentiment(SentimentCategory.mixed),
      BitmapDescriptor.hueMagenta,
    );
    expect(
      AuraMarkerHue.fromSentiment(SentimentCategory.neutral),
      BitmapDescriptor.hueRose,
    );
  });

  test('falls back to neutral hue for unknown aura colors', () {
    expect(AuraMarkerHue.fromColorHex('#123456'), BitmapDescriptor.hueRose);
  });
}
