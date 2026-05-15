import 'package:echoes/features/aura/data/aura_zone_dto.dart';
import 'package:echoes/features/aura/domain/aura_history_entry.dart';

class AuraHistoryEntryDto {
  const AuraHistoryEntryDto({
    required this.id,
    required this.placeId,
    required this.aura,
    required this.recordedAt,
  });

  factory AuraHistoryEntryDto.fromDomain(AuraHistoryEntry entry) {
    return AuraHistoryEntryDto(
      id: entry.id,
      placeId: entry.placeId,
      aura: AuraZoneDto.fromDomain(entry.aura),
      recordedAt: entry.recordedAt,
    );
  }

  factory AuraHistoryEntryDto.fromMap(String id, Map<String, Object?> map) {
    return AuraHistoryEntryDto(
      id: id,
      placeId: map['placeId']! as String,
      aura: AuraZoneDto.fromMap(map['aura']! as Map<String, Object?>),
      recordedAt: DateTime.parse(map['recordedAt']! as String),
    );
  }

  final String id;
  final String placeId;
  final AuraZoneDto aura;
  final DateTime recordedAt;

  AuraHistoryEntry toDomain() {
    return AuraHistoryEntry(
      id: id,
      placeId: placeId,
      aura: aura.toDomain(),
      recordedAt: recordedAt,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'placeId': placeId,
      'aura': aura.toMap(),
      'recordedAt': recordedAt.toUtc().toIso8601String(),
    };
  }
}
