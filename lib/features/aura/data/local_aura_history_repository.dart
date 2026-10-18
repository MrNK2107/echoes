import 'dart:async';

import 'package:echoes/features/aura/domain/aura_history_entry.dart';
import 'package:echoes/features/aura/domain/aura_history_repository.dart';

class LocalAuraHistoryRepository implements AuraHistoryRepository {
  final Map<String, List<AuraHistoryEntry>> _entriesByPlace = {};
  final _controller = StreamController<List<AuraHistoryEntry>>.broadcast();

  @override
  Future<void> recordSnapshot(AuraHistoryEntry entry) async {
    final entries = _entriesByPlace.putIfAbsent(entry.placeId, () => []);
    entries.add(entry);
    entries.sort((a, b) => b.recordedAt.compareTo(a.recordedAt));
    _notify(entry.placeId);
  }

  @override
  Stream<List<AuraHistoryEntry>> watchAuraHistory(
    String placeId, {
    int limit = 30,
  }) async* {
    yield _entriesByPlace[placeId]?.take(limit).toList() ?? [];
    yield* _controller.stream.map((_) {
      return _entriesByPlace[placeId]?.take(limit).toList() ?? [];
    });
  }

  void _notify(String placeId) {
    _controller.add(_entriesByPlace[placeId] ?? []);
  }

  void dispose() {
    _controller.close();
  }
}
