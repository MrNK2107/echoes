import 'package:echoes/features/aura/domain/aura_zone.dart';

class AuraHistoryEntry {
  const AuraHistoryEntry({
    required this.id,
    required this.placeId,
    required this.aura,
    required this.recordedAt,
  });

  final String id;
  final String placeId;
  final AuraZone aura;
  final DateTime recordedAt;
}
