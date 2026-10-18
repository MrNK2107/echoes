import 'package:echoes/features/institutions/domain/campus_sub_zone.dart';
import 'package:echoes/features/institutions/domain/institution_zone.dart';

class InstitutionZoneDto {
  const InstitutionZoneDto();

  static Map<String, Object?> toMap(InstitutionZone zone) => {
    'name': zone.name,
    'allowedEmailDomains': zone.allowedEmailDomains,
    'verifiedAdminUserIds': zone.verifiedAdminUserIds,
    'subZones': [
      for (final subZone in zone.subZones)
        {
          'id': subZone.id,
          'name': subZone.name,
          'latitude': subZone.latitude,
          'longitude': subZone.longitude,
          'radiusMeters': subZone.radiusMeters,
        },
    ],
  };

  static InstitutionZone fromMap(String id, Map<String, Object?> map) {
    final rawSubZones = map['subZones'] as List<dynamic>? ?? const [];
    return InstitutionZone(
      id: id,
      name: map['name'] as String? ?? '',
      allowedEmailDomains: List<String>.from(
        map['allowedEmailDomains'] as List<dynamic>? ?? const [],
      ),
      verifiedAdminUserIds: List<String>.from(
        map['verifiedAdminUserIds'] as List<dynamic>? ?? const [],
      ),
      subZones: [
        for (final raw in rawSubZones)
          if (raw is Map)
            CampusSubZone(
              id: raw['id'] as String,
              name: raw['name'] as String,
              latitude: (raw['latitude'] as num).toDouble(),
              longitude: (raw['longitude'] as num).toDouble(),
              radiusMeters: (raw['radiusMeters'] as num).toDouble(),
            ),
      ],
    );
  }
}
