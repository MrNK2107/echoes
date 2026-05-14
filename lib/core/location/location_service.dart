import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/core/location/location_permission_state.dart';

abstract interface class LocationService {
  Future<LocationPermissionState> checkPermission();

  Future<LocationPermissionState> requestPermission();

  Future<DeviceLocation> getCurrentLocation();
}
