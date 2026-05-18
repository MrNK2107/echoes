import 'package:echoes/features/notifications/domain/push_notification_message.dart';

abstract interface class PushNotificationService {
  Future<void> initialize();

  Future<String?> currentToken();

  Stream<String> get tokenRefreshes;

  Stream<PushNotificationMessage> get foregroundMessages;
}
