import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('FeaturePlaceholder supports large text scaling', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(360, 640),
            textScaler: TextScaler.linear(2),
          ),
          child: Scaffold(
            body: FeaturePlaceholder(
              icon: Icons.travel_explore,
              title: 'Places remember first.',
              description:
                  'The map will use your current location to show nearby places with memories, aura colors, and quick access to details.',
              nextStep:
                  'Next: enable location, then connect Google Maps and nearby place queries.',
              action: FilledButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.my_location),
                label: const Text('Enable location'),
              ),
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.byType(SingleChildScrollView), findsOneWidget);
    expect(find.text('Places remember first.'), findsOneWidget);
    expect(find.text('Enable location'), findsOneWidget);
  });
}
