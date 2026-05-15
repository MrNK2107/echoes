import 'package:echoes/features/ar/domain/ar_permission_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_state.dart';

class LocalArPermissionService implements ArPermissionService {
  const LocalArPermissionService({
    this.initialPermission = ArPermissionState.denied,
    this.requestedPermission = ArPermissionState.granted,
  });

  final ArPermissionState initialPermission;
  final ArPermissionState requestedPermission;

  @override
  Future<ArPermissionState> checkPermission() async => initialPermission;

  @override
  Future<ArPermissionState> requestPermission() async => requestedPermission;
}
