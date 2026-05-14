import 'package:echoes/features/ar/data/local_ar_availability_service.dart';
import 'package:echoes/features/ar/domain/ar_availability.dart';
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
      );

      await cubit.checkAvailability();

      expect(cubit.state.status, ArStatus.ready);
      await cubit.close();
    });

    test('enters fallback state when AR is unsupported', () async {
      final cubit = ArCubit(
        availabilityService: const LocalArAvailabilityService(),
      );

      await cubit.checkAvailability();

      expect(cubit.state.status, ArStatus.unsupported);
      await cubit.close();
    });
  });
}
