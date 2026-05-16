import 'package:echoes/features/ar/data/local_ar_availability_service.dart';
import 'package:echoes/features/ar/data/local_ar_permission_service.dart';
import 'package:echoes/features/ar/data/local_ar_session_service.dart';
import 'package:echoes/features/ar/domain/ar_availability.dart';
import 'package:echoes/features/ar/domain/ar_permission_state.dart';
import 'package:echoes/features/ar/presentation/ar_cubit.dart';
import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ArCubit', () {
    test('enters ready state when AR is supported', () async {
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(
          availability: ArAvailability.supported,
        ),
        permissionService: const LocalArPermissionService(
          initialPermission: ArPermissionState.granted,
        ),
        sessionService: LocalArSessionService(),
      );

      await cubit.checkAvailability();

      expect(cubit.state.status, ArStatus.ready);
      await cubit.close();
    });

    test('enters fallback state when AR is unsupported', () async {
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(),
        permissionService: const LocalArPermissionService(),
        sessionService: LocalArSessionService(),
      );

      await cubit.checkAvailability();

      expect(cubit.state.status, ArStatus.unsupported);
      await cubit.close();
    });

    test('requires camera permission before AR can start', () async {
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(
          availability: ArAvailability.supported,
        ),
        permissionService: const LocalArPermissionService(
          initialPermission: ArPermissionState.denied,
        ),
        sessionService: LocalArSessionService(),
      );

      await cubit.checkAvailability();

      expect(cubit.state.status, ArStatus.permissionDenied);
      await cubit.close();
    });

    test('enters ready state after camera permission is granted', () async {
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(
          availability: ArAvailability.supported,
        ),
        permissionService: const LocalArPermissionService(
          initialPermission: ArPermissionState.denied,
          requestedPermission: ArPermissionState.granted,
        ),
        sessionService: LocalArSessionService(),
      );

      await cubit.requestPermission();

      expect(cubit.state.status, ArStatus.ready);
      await cubit.close();
    });

    test('starts and stops an AR session safely', () async {
      final sessionService = LocalArSessionService();
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(
          availability: ArAvailability.supported,
        ),
        permissionService: const LocalArPermissionService(
          initialPermission: ArPermissionState.granted,
        ),
        sessionService: sessionService,
      );

      await cubit.checkAvailability();
      await cubit.startSession();

      expect(cubit.state.status, ArStatus.running);
      expect(cubit.state.isSessionRunning, isTrue);
      expect(sessionService.isRunning, isTrue);

      await cubit.stopSession();

      expect(cubit.state.status, ArStatus.ready);
      expect(cubit.state.isSessionRunning, isFalse);
      expect(sessionService.isRunning, isFalse);
      await cubit.close();
    });

    test('stops a running AR session when closed', () async {
      final sessionService = LocalArSessionService();
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(
          availability: ArAvailability.supported,
        ),
        permissionService: const LocalArPermissionService(
          initialPermission: ArPermissionState.granted,
        ),
        sessionService: sessionService,
      );

      await cubit.checkAvailability();
      await cubit.startSession();
      await cubit.close();

      expect(sessionService.isRunning, isFalse);
    });
  });
}
