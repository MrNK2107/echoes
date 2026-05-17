import 'package:echoes/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('EmptyState renders icon, title, and description', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: EmptyState(
            icon: Icons.auto_stories_outlined,
            title: 'No memories yet.',
            description: 'Saved memories will appear here.',
          ),
        ),
      ),
    );

    expect(find.byIcon(Icons.auto_stories_outlined), findsOneWidget);
    expect(find.text('No memories yet.'), findsOneWidget);
    expect(find.text('Saved memories will appear here.'), findsOneWidget);
  });
}
