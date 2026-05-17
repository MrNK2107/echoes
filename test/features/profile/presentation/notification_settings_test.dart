import 'package:echoes/features/notifications/data/local_notification_permission_service.dart';
import 'package:echoes/features/notifications/domain/notification_permission_service.dart';
import 'package:echoes/features/notifications/domain/notification_permission_status.dart';
import 'package:echoes/features/profile/presentation/notification_settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders and toggles notification settings', (tester) async {
    await tester.pumpWidget(
      const _TestApp(permissionService: LocalNotificationPermissionService()),
    );
    await tester.pump();

    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Notification permission enabled'), findsOneWidget);
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

  testWidgets('requests notification permission from settings', (tester) async {
    await tester.pumpWidget(
      const _TestApp(
        permissionService: LocalNotificationPermissionService(
          initialStatus: NotificationPermissionStatus.denied,
          requestedStatus: NotificationPermissionStatus.granted,
        ),
      ),
    );
    await tester.pump();

    expect(
      find.text('Enable notifications for transfers, tags, and invites.'),
      findsOneWidget,
    );

    await tester.tap(
      find.byKey(const ValueKey('requestNotificationPermissionButton')),
    );
    await tester.pump();

    expect(find.text('Notification permission enabled'), findsOneWidget);
  });
}

class _TestApp extends StatelessWidget {
  const _TestApp({required this.permissionService});

  final NotificationPermissionService permissionService;

  @override
  Widget build(BuildContext context) {
    return RepositoryProvider<NotificationPermissionService>.value(
      value: permissionService,
      child: const MaterialApp(home: Scaffold(body: NotificationSettings())),
    );
  }
}
