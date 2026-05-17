import 'package:echoes/features/notifications/domain/notification_permission_service.dart';
import 'package:echoes/features/notifications/domain/notification_permission_status.dart';

class LocalNotificationPermissionService
    implements NotificationPermissionService {
  const LocalNotificationPermissionService({
    this.initialStatus = NotificationPermissionStatus.granted,
    this.requestedStatus = NotificationPermissionStatus.granted,
  });

  final NotificationPermissionStatus initialStatus;
  final NotificationPermissionStatus requestedStatus;

  @override
  Future<NotificationPermissionStatus> checkPermission() async {
    return initialStatus;
  }

  @override
  Future<NotificationPermissionStatus> requestPermission() async {
    return requestedStatus;
  }
}
