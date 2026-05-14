import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/core/location/location_permission_state.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/map/presentation/map_cubit.dart';
import 'package:echoes/features/map/presentation/map_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('MapCubit', () {
    test('loads current location when permission is granted', () async {
      final service = _FakeLocationService(
        permission: LocationPermissionState.granted,
      );
      final cubit = MapCubit(locationService: service);

      await cubit.requestLocation();

      expect(cubit.state.status, MapStatus.ready);
      expect(cubit.state.location?.latitude, 12.9716);
      await cubit.close();
    });

    test('requests permission when initial permission is unknown', () async {
      final service = _FakeLocationService(
        permission: LocationPermissionState.unknown,
        requestedPermission: LocationPermissionState.granted,
      );
      final cubit = MapCubit(locationService: service);

      await cubit.requestLocation();

      expect(service.requestWasCalled, isTrue);
      expect(cubit.state.status, MapStatus.ready);
      await cubit.close();
    });

    test('emits denied forever state when permission is blocked', () async {
      final service = _FakeLocationService(
        permission: LocationPermissionState.deniedForever,
      );
      final cubit = MapCubit(locationService: service);

      await cubit.requestLocation();

      expect(cubit.state.status, MapStatus.permissionDeniedForever);
      expect(cubit.state.location, isNull);
      await cubit.close();
    });
  });
}

class _FakeLocationService implements LocationService {
  _FakeLocationService({required this.permission, this.requestedPermission});

  LocationPermissionState permission;
  LocationPermissionState? requestedPermission;
  bool requestWasCalled = false;

  @override
  Future<LocationPermissionState> checkPermission() async => permission;

  @override
  Future<DeviceLocation> getCurrentLocation() async {
    return const DeviceLocation(
      latitude: 12.9716,
      longitude: 77.5946,
      accuracyMeters: 12,
    );
  }

  @override
  Future<LocationPermissionState> requestPermission() async {
    requestWasCalled = true;
    permission = requestedPermission ?? permission;
    return permission;
  }
}
