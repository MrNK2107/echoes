import 'package:echoes/features/profile/presentation/notification_settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders and toggles notification settings', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: NotificationSettings()),
      ),
    );

    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Custodianship requests'), findsOneWidget);
    expect(find.text('Tagged memories'), findsOneWidget);
    expect(find.text('Community invitations'), findsOneWidget);

    final communitySwitch = tester.widget<SwitchListTile>(
      find.byKey(const ValueKey('communityNotificationToggle')),
    );
    expect(communitySwitch.value, isFalse);

    await tester.tap(find.byKey(const ValueKey('communityNotificationToggle')));
    await tester.pumpAndSettle();

    final updatedCommunitySwitch = tester.widget<SwitchListTile>(
      find.byKey(const ValueKey('communityNotificationToggle')),
    );
    expect(updatedCommunitySwitch.value, isTrue);
  });
}
