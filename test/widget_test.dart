import 'package:echoes/app/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders auth screen before session starts', (tester) async {
    await tester.pumpWidget(const EchoesApp());
    await tester.pumpAndSettle();

    expect(find.text('ECHOES'), findsOneWidget);
    expect(
      find.text('Places hold more memories than people do.'),
      findsOneWidget,
    );
    expect(find.text('Sign in'), findsOneWidget);
  });

  testWidgets('signs in and renders ECHOES home shell destinations', (
    tester,
  ) async {
    await tester.pumpWidget(const EchoesApp());
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('emailField')),
      'nanda@example.com',
    );
    await tester.enterText(
      find.byKey(const ValueKey('passwordField')),
      'password123',
    );
    await tester.tap(find.byKey(const ValueKey('authSubmitButton')));
    await tester.pumpAndSettle();

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
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('emailField')),
      'nanda@example.com',
    );
    await tester.enterText(
      find.byKey(const ValueKey('passwordField')),
      'password123',
    );
    await tester.tap(find.byKey(const ValueKey('authSubmitButton')));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();

    expect(find.text('Add Memory'), findsOneWidget);
    expect(find.text('Capture a memory.'), findsOneWidget);

    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();

    expect(find.text('Profile'), findsWidgets);
    expect(find.text('nanda@example.com'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('deleteAccountPlaceholderButton')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('signOutButton')), findsOneWidget);
    expect(find.byIcon(Icons.account_circle_outlined), findsOneWidget);
  });

  testWidgets('signs out from profile and returns to auth screen', (
    tester,
  ) async {
    await tester.pumpWidget(const EchoesApp());
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('emailField')),
      'nanda@example.com',
    );
    await tester.enterText(
      find.byKey(const ValueKey('passwordField')),
      'password123',
    );
    await tester.tap(find.byKey(const ValueKey('authSubmitButton')));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();

    expect(find.text('nanda@example.com'), findsOneWidget);

    await tester.ensureVisible(find.byKey(const ValueKey('signOutButton')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('signOutButton')));
    await tester.pumpAndSettle();

    expect(find.text('Sign in'), findsOneWidget);
  });
}
