import 'package:echoes/app/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders ECHOES home shell with primary destinations', (
    tester,
  ) async {
    await tester.pumpWidget(const EchoesApp());

    expect(find.text('Nearby Echoes'), findsOneWidget);
    expect(find.text('Places remember first.'), findsOneWidget);

    for (final label in ['Map', 'AR', 'Add', 'Communities', 'Profile']) {
      expect(find.text(label), findsOneWidget);
    }
  });

  testWidgets('switches between bottom navigation destinations', (
    tester,
  ) async {
    await tester.pumpWidget(const EchoesApp());

    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();

    expect(find.text('Add Memory'), findsOneWidget);
    expect(find.text('Capture a memory.'), findsOneWidget);

    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();

    expect(find.text('Profile'), findsWidgets);
    expect(find.text('Custodianship starts here.'), findsOneWidget);
    expect(find.byIcon(Icons.account_circle_outlined), findsOneWidget);
  });
}
