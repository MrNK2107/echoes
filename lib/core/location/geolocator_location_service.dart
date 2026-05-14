import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/core/location/location_permission_state.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:geolocator/geolocator.dart';

class GeolocatorLocationService implements LocationService {
  @override
  Future<LocationPermissionState> checkPermission() async {
    return _mapPermission(await Geolocator.checkPermission());
  }

  @override
  Future<DeviceLocation> getCurrentLocation() async {
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );

    return DeviceLocation(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: position.accuracy,
    );
  }

  @override
  Future<LocationPermissionState> requestPermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return LocationPermissionState.denied;
    }

    return _mapPermission(await Geolocator.requestPermission());
  }

  LocationPermissionState _mapPermission(LocationPermission permission) {
    return switch (permission) {
      LocationPermission.always ||
      LocationPermission.whileInUse => LocationPermissionState.granted,
      LocationPermission.denied => LocationPermissionState.denied,
      LocationPermission.deniedForever => LocationPermissionState.deniedForever,
      LocationPermission.unableToDetermine => LocationPermissionState.unknown,
    };
  }
}
