import 'package:echoes/features/ar/domain/ar_permission_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_state.dart';
import 'package:permission_handler/permission_handler.dart';

class DeviceArPermissionService implements ArPermissionService {
  const DeviceArPermissionService();

  @override
  Future<ArPermissionState> checkPermission() async {
    return _mapStatus(await Permission.camera.status);
  }

  @override
  Future<ArPermissionState> requestPermission() async {
    return _mapStatus(await Permission.camera.request());
  }

  ArPermissionState _mapStatus(PermissionStatus status) {
    if (status.isGranted || status.isLimited) {
      return ArPermissionState.granted;
    }
    if (status.isPermanentlyDenied || status.isRestricted) {
      return ArPermissionState.permanentlyDenied;
    }
    if (status.isDenied) {
      return ArPermissionState.denied;
    }
    return ArPermissionState.unknown;
  }
}
