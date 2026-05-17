enum NotificationPermissionStatus {
  unknown,
  granted,
  denied,
  permanentlyDenied,
}

extension NotificationPermissionStatusX on NotificationPermissionStatus {
  bool get isGranted => this == NotificationPermissionStatus.granted;
}
