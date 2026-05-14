import 'package:echoes/features/aura/data/aura_zone_dto.dart';
import 'package:echoes/features/places/domain/place.dart';

class PlaceDto {
  const PlaceDto({
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
  });

  factory PlaceDto.fromDomain(Place place) {
    return PlaceDto(
      id: place.id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      geohash: place.geohash,
      communityId: place.communityId,
      custodianIds: place.custodianIds,
      aura: AuraZoneDto.fromDomain(place.aura),
      memoryCount: place.memoryCount,
      publicMemoryCount: place.publicMemoryCount,
      createdAt: place.createdAt,
      updatedAt: place.updatedAt,
    );
  }

  factory PlaceDto.fromMap(String id, Map<String, Object?> map) {
    return PlaceDto(
      id: id,
      name: map['name']! as String,
      latitude: (map['latitude']! as num).toDouble(),
      longitude: (map['longitude']! as num).toDouble(),
      geohash: map['geohash']! as String,
      communityId: map['communityId'] as String?,
      custodianIds: List<String>.from(map['custodianIds']! as List),
      aura: AuraZoneDto.fromMap(map['aura']! as Map<String, Object?>),
      memoryCount: map['memoryCount']! as int,
      publicMemoryCount: map['publicMemoryCount']! as int,
      createdAt: DateTime.parse(map['createdAt']! as String),
      updatedAt: DateTime.parse(map['updatedAt']! as String),
    );
  }

  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final String geohash;
  final String? communityId;
  final List<String> custodianIds;
  final AuraZoneDto aura;
  final int memoryCount;
  final int publicMemoryCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  Place toDomain() {
    return Place(
      id: id,
      name: name,
      latitude: latitude,
      longitude: longitude,
      geohash: geohash,
      communityId: communityId,
      custodianIds: custodianIds,
      aura: aura.toDomain(),
      memoryCount: memoryCount,
      publicMemoryCount: publicMemoryCount,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'name': name,
      'latitude': latitude,
      'longitude': longitude,
      'geohash': geohash,
      'communityId': communityId,
      'custodianIds': custodianIds,
      'aura': aura.toMap(),
      'memoryCount': memoryCount,
      'publicMemoryCount': publicMemoryCount,
      'createdAt': createdAt.toUtc().toIso8601String(),
      'updatedAt': updatedAt.toUtc().toIso8601String(),
    };
  }
}
