class CampusSubZone {
  const CampusSubZone({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
  }) : assert(latitude >= -90 && latitude <= 90),
       assert(longitude >= -180 && longitude <= 180),
       assert(radiusMeters > 0);

  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final double radiusMeters;
}
