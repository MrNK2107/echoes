import 'package:echoes/features/aura/domain/aura_zone.dart';

class Place {
  const Place({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.geohash,
    required this.custodianIds,
    required this.aura,
    required this.memoryCount,
    required this.publicMemoryCount,
    required this.createdAt,
    required this.updatedAt,
    this.communityId,
  }) : assert(latitude >= -90 && latitude <= 90),
       assert(longitude >= -180 && longitude <= 180),
       assert(memoryCount >= 0),
       assert(publicMemoryCount >= 0);

  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final String geohash;
  final String? communityId;
  final List<String> custodianIds;
  final AuraZone aura;
  final int memoryCount;
  final int publicMemoryCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  Place copyWith({
    String? id,
    String? name,
    double? latitude,
    double? longitude,
    String? geohash,
    String? communityId,
    List<String>? custodianIds,
    AuraZone? aura,
    int? memoryCount,
    int? publicMemoryCount,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Place(
      id: id ?? this.id,
      name: name ?? this.name,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      geohash: geohash ?? this.geohash,
      communityId: communityId ?? this.communityId,
      custodianIds: custodianIds ?? this.custodianIds,
      aura: aura ?? this.aura,
      memoryCount: memoryCount ?? this.memoryCount,
      publicMemoryCount: publicMemoryCount ?? this.publicMemoryCount,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
