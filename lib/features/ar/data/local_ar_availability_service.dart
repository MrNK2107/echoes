import 'package:echoes/features/ar/domain/ar_availability.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';

class LocalArAvailabilityService implements ArAvailabilityService {
  const LocalArAvailabilityService({
    this.availability = ArAvailability.unsupported,
  });

  final ArAvailability availability;

  @override
  Future<ArAvailability> checkAvailability() async => availability;
}
