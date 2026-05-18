import 'package:echoes/features/institutions/domain/campus_sub_zone.dart';

class InstitutionZone {
  const InstitutionZone({
    required this.id,
    required this.name,
    required this.allowedEmailDomains,
    this.verifiedAdminUserIds = const [],
    this.subZones = const [],
  });

  final String id;
  final String name;
  final List<String> allowedEmailDomains;
  final List<String> verifiedAdminUserIds;
  final List<CampusSubZone> subZones;

  InstitutionZone copyWith({
    List<String>? verifiedAdminUserIds,
    List<CampusSubZone>? subZones,
  }) {
    return InstitutionZone(
      id: id,
      name: name,
      allowedEmailDomains: allowedEmailDomains,
      verifiedAdminUserIds: verifiedAdminUserIds ?? this.verifiedAdminUserIds,
      subZones: subZones ?? this.subZones,
    );
  }
}
