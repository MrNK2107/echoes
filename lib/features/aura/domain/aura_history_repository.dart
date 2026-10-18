import 'package:echoes/features/aura/domain/aura_history_entry.dart';

abstract interface class AuraHistoryRepository {
  Stream<List<AuraHistoryEntry>> watchAuraHistory(
    String placeId, {
    int limit = 30,
  });

  Future<void> recordSnapshot(AuraHistoryEntry entry);
}
