import 'package:echoes/features/notifications/domain/push_notification_message.dart';
import 'package:echoes/features/notifications/domain/push_notification_service.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

@pragma('vm:entry-point')
Future<void> echoesFirebaseMessagingBackgroundHandler(
  RemoteMessage message,
) async {
  // Background handling is registered now; product-specific routing arrives
  // with transfer, tag, and community notification workflows.
}

class FirebasePushNotificationService implements PushNotificationService {
  FirebasePushNotificationService({FirebaseMessaging? messaging})
    : _messaging = messaging ?? FirebaseMessaging.instance;

  final FirebaseMessaging _messaging;

  static void registerBackgroundHandler() {
    FirebaseMessaging.onBackgroundMessage(
      echoesFirebaseMessagingBackgroundHandler,
    );
  }

  @override
  Stream<PushNotificationMessage> get foregroundMessages =>
      FirebaseMessaging.onMessage.map(_mapMessage);

  @override
  Stream<String> get tokenRefreshes => _messaging.onTokenRefresh;

  @override
  Future<String?> currentToken() {
    return _messaging.getToken();
  }

  @override
  Future<void> initialize() async {
    await _messaging.setAutoInitEnabled(true);
  }

  static PushNotificationMessage _mapMessage(RemoteMessage message) {
    return PushNotificationMessage(
      id: message.messageId ?? message.sentTime?.toIso8601String() ?? '',
      title: message.notification?.title,
      body: message.notification?.body,
      data: message.data.map((key, value) => MapEntry(key, value.toString())),
      sentAt: message.sentTime,
    );
  }
}
