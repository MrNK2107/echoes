import 'package:echoes/features/ar/domain/ar_availability.dart';

abstract interface class ArAvailabilityService {
  Future<ArAvailability> checkAvailability();
}
