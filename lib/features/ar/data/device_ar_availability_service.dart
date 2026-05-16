import 'package:echoes/features/ar/domain/ar_availability.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';
import 'package:flutter/foundation.dart';

class DeviceArAvailabilityService implements ArAvailabilityService {
  const DeviceArAvailabilityService();

  @override
  Future<ArAvailability> checkAvailability() async {
    return switch (defaultTargetPlatform) {
      TargetPlatform.android || TargetPlatform.iOS => ArAvailability.supported,
      _ => ArAvailability.unsupported,
    };
  }
}
