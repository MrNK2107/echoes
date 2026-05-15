import 'package:echoes/features/places/presentation/place_custodians.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders sorted custodian ids', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PlaceCustodians(custodianIds: ['user-b', 'user-a']),
        ),
      ),
    );

    expect(find.text('Custodians'), findsOneWidget);
    expect(find.text('user-a'), findsOneWidget);
    expect(find.text('user-b'), findsOneWidget);
    expect(find.byIcon(Icons.shield_outlined), findsNWidgets(2));
  });

  testWidgets('renders empty state without custodians', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: PlaceCustodians(custodianIds: [])),
      ),
    );

    expect(find.text('No custodians assigned yet.'), findsOneWidget);
  });
}
