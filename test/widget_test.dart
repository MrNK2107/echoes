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

  testWidgets('home shell exposes semantic labels for navigation tabs', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();

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

    expect(find.bySemanticsLabel('Primary app navigation'), findsOneWidget);
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Semantics &&
            widget.properties.header == true &&
            widget.child is Text &&
            (widget.child! as Text).data == 'Nearby Echoes',
      ),
      findsOneWidget,
    );

    for (final label in [
      'Open map tab',
      'Open AR tab',
      'Open add memory tab',
      'Open communities tab',
      'Open profile tab',
    ]) {
      expect(
        find.byWidgetPredicate(
          (widget) => widget is Icon && widget.semanticLabel == label,
        ),
        findsWidgets,
      );
    }

    semantics.dispose();
  });

  testWidgets('primary touch targets are at least 44dp', (tester) async {
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

    _expectMinTouchTarget(tester, find.byType(BottomNavigationBar));
    _expectMinTouchTarget(
      tester,
      find.byKey(const ValueKey('requestLocationButton')),
    );

    await tester.tap(find.text('Communities'));
    await tester.pumpAndSettle();
    _expectMinTouchTarget(
      tester,
      find.byKey(const ValueKey('createCommunityButton')),
    );

    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('signOutButton')));
    await tester.pumpAndSettle();
    _expectMinTouchTarget(tester, find.byKey(const ValueKey('signOutButton')));
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

void _expectMinTouchTarget(WidgetTester tester, Finder finder) {
  final size = tester.getSize(finder);

  expect(size.width, greaterThanOrEqualTo(44));
  expect(size.height, greaterThanOrEqualTo(44));
}
