import 'package:echoes/shared/widgets/loading_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('LoadingState renders accessible progress feedback', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: LoadingState(label: 'Loading memories')),
      ),
    );

    expect(find.text('Loading memories'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Semantics &&
            widget.properties.label == 'Loading memories',
      ),
      findsOneWidget,
    );

    semantics.dispose();
  });
}
