import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/core/location/location_permission_state.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/memories/data/local_memory_repository.dart';
import 'package:echoes/features/memories/presentation/add_memory_cubit.dart';
import 'package:echoes/features/memories/presentation/add_memory_status.dart';
import 'package:echoes/features/places/data/local_place_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AddMemoryCubit', () {
    test('captures location and creates a memory', () async {
      final memoryRepository = LocalMemoryRepository();
      final cubit = AddMemoryCubit(
        locationService: _FakeLocationService(
          permission: LocationPermissionState.granted,
        ),
        placeRepository: LocalPlaceRepository(now: DateTime.utc(2026, 5, 14)),
        memoryRepository: memoryRepository,
      );

      await cubit.captureLocation();
      expect(cubit.state.status, AddMemoryStatus.ready);
      expect(cubit.state.location?.latitude, 12.9716);

      await cubit.submit(
        userId: 'user-1',
        textContent: 'The courtyard was glowing after the farewell.',
      );

      expect(cubit.state.status, AddMemoryStatus.success);

      final memories = await memoryRepository
          .watchMemoriesForUser('user-1')
          .first;
      expect(memories, hasLength(1));
      expect(memories.single.textContent, contains('courtyard'));
      await cubit.close();
      memoryRepository.dispose();
    });

    test('fails submit when location has not been captured', () async {
      final cubit = AddMemoryCubit(
        locationService: _FakeLocationService(
          permission: LocationPermissionState.granted,
        ),
        placeRepository: LocalPlaceRepository(now: DateTime.utc(2026, 5, 14)),
        memoryRepository: LocalMemoryRepository(),
      );

      await cubit.submit(userId: 'user-1', textContent: 'No place yet');

      expect(cubit.state.status, AddMemoryStatus.failure);
      expect(cubit.state.errorMessage, 'Capture location before saving.');
      await cubit.close();
    });
  });
}

class _FakeLocationService implements LocationService {
  _FakeLocationService({required this.permission});

  LocationPermissionState permission;

  @override
  Future<LocationPermissionState> checkPermission() async => permission;

  @override
  Future<DeviceLocation> getCurrentLocation() async {
    return const DeviceLocation(
      latitude: 12.9716,
      longitude: 77.5946,
      accuracyMeters: 8,
    );
  }

  @override
  Future<LocationPermissionState> requestPermission() async => permission;
}
