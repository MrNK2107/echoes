import 'package:echoes/features/notifications/data/local_push_notification_service.dart';
import 'package:echoes/features/notifications/domain/push_notification_message.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('initializes and exposes current token', () async {
    final service = LocalPushNotificationService(initialToken: 'token-1');

    await service.initialize();

    expect(service.isInitialized, isTrue);
    expect(await service.currentToken(), 'token-1');

    await service.dispose();
  });

  test('emits token refreshes and foreground messages', () async {
    final service = LocalPushNotificationService();
    final tokenRefreshes = <String>[];
    final messages = <PushNotificationMessage>[];
    final tokenSubscription = service.tokenRefreshes.listen(tokenRefreshes.add);
    final messageSubscription = service.foregroundMessages.listen(messages.add);

    service.emitTokenRefresh('token-2');
    service.emitForegroundMessage(
      const PushNotificationMessage(
        id: 'message-1',
        title: 'Transfer request',
        body: 'A custodian invited you.',
        data: {'type': 'transfer'},
      ),
    );
    await Future<void>.delayed(Duration.zero);

    expect(tokenRefreshes, ['token-2']);
    expect(messages.single.data, {'type': 'transfer'});

    await tokenSubscription.cancel();
    await messageSubscription.cancel();
    await service.dispose();
  });
}
