import 'package:echoes/features/notifications/domain/notification_permission_status.dart';

abstract interface class NotificationPermissionService {
  Future<NotificationPermissionStatus> checkPermission();

  Future<NotificationPermissionStatus> requestPermission();
}
