import 'package:echoes/app/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('sign-in and primary navigation smoke flow', (tester) async {
    await tester.pumpWidget(const EchoesApp());
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('emailField')),
      'device-smoke@example.com',
    );
    await tester.enterText(
      find.byKey(const ValueKey('passwordField')),
      'password123',
    );
    await tester.tap(find.byKey(const ValueKey('authSubmitButton')));
    await tester.pumpAndSettle();

    expect(find.text('Nearby Echoes'), findsOneWidget);
    for (final destination in ['Map', 'AR', 'Add', 'Communities', 'Profile']) {
      await tester.tap(find.text(destination));
      await tester.pumpAndSettle();
      expect(find.text(destination), findsWidgets);
    }
  });
}
