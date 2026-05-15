import 'package:echoes/features/ar/domain/ar_permission_state.dart';

abstract interface class ArPermissionService {
  Future<ArPermissionState> checkPermission();

  Future<ArPermissionState> requestPermission();
}
