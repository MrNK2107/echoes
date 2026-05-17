import 'package:echoes/features/notifications/domain/notification_permission_service.dart';
import 'package:echoes/features/notifications/domain/notification_permission_status.dart';
import 'package:permission_handler/permission_handler.dart';

class DeviceNotificationPermissionService
    implements NotificationPermissionService {
  const DeviceNotificationPermissionService();

  @override
  Future<NotificationPermissionStatus> checkPermission() async {
    return _mapStatus(await Permission.notification.status);
  }

  @override
  Future<NotificationPermissionStatus> requestPermission() async {
    return _mapStatus(await Permission.notification.request());
  }

  NotificationPermissionStatus _mapStatus(PermissionStatus status) {
    if (status.isGranted || status.isLimited || status.isProvisional) {
      return NotificationPermissionStatus.granted;
    }
    if (status.isPermanentlyDenied || status.isRestricted) {
      return NotificationPermissionStatus.permanentlyDenied;
    }
    if (status.isDenied) {
      return NotificationPermissionStatus.denied;
    }
    return NotificationPermissionStatus.unknown;
  }
}
