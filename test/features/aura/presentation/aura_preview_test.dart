import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_category.dart';
import 'package:echoes/features/aura/presentation/aura_preview.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders aura sentiment, intensity, and memory count', (
    tester,
  ) async {
    final aura = AuraZone(
      dominantSentiment: SentimentCategory.positive,
      compoundScore: 0.72,
      intensity: 0.64,
      memoryCount: 12,
      colorHex: AuraZone.colorHexFor(SentimentCategory.positive),
      updatedAt: DateTime.utc(2026, 5, 15),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AuraPreview(aura: aura)),
      ),
    );

    expect(find.text('Aura'), findsOneWidget);
    expect(find.text('Positive'), findsOneWidget);
    expect(find.text('64% intensity from 12 public memories'), findsOneWidget);
    expect(find.byIcon(Icons.blur_circular), findsOneWidget);
    expect(find.byType(TweenAnimationBuilder<double>), findsNWidgets(2));

    await tester.pump(const Duration(milliseconds: 900));

    final progress = tester.widget<LinearProgressIndicator>(
      find.byType(LinearProgressIndicator),
    );
    expect(progress.value, closeTo(0.64, 0.01));
  });
}
