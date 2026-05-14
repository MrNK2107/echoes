class DeviceLocation {
  const DeviceLocation({
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
  }) : assert(latitude >= -90 && latitude <= 90),
       assert(longitude >= -180 && longitude <= 180),
       assert(accuracyMeters >= 0);

  final double latitude;
  final double longitude;
  final double accuracyMeters;
}
