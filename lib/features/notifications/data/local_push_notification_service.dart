import 'dart:async';

import 'package:echoes/features/notifications/domain/push_notification_message.dart';
import 'package:echoes/features/notifications/domain/push_notification_service.dart';

class LocalPushNotificationService implements PushNotificationService {
  LocalPushNotificationService({this.initialToken});

  final String? initialToken;
  final _tokenRefreshController = StreamController<String>.broadcast();
  final _foregroundMessageController =
      StreamController<PushNotificationMessage>.broadcast();
  var _initialized = false;

  bool get isInitialized => _initialized;

  @override
  Stream<PushNotificationMessage> get foregroundMessages =>
      _foregroundMessageController.stream;

  @override
  Stream<String> get tokenRefreshes => _tokenRefreshController.stream;

  @override
  Future<String?> currentToken() async => initialToken;

  @override
  Future<void> initialize() async {
    _initialized = true;
  }

  void emitTokenRefresh(String token) {
    _tokenRefreshController.add(token);
  }

  void emitForegroundMessage(PushNotificationMessage message) {
    _foregroundMessageController.add(message);
  }

  Future<void> dispose() async {
    await _tokenRefreshController.close();
    await _foregroundMessageController.close();
  }
}
