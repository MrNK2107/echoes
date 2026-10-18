import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/aura/data/aura_history_entry_dto.dart';
import 'package:echoes/features/aura/domain/aura_history_entry.dart';
import 'package:echoes/features/aura/domain/aura_history_repository.dart';

class FirestoreAuraHistoryRepository implements AuraHistoryRepository {
  FirestoreAuraHistoryRepository({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> _collection(String placeId) =>
      _firestore.collection('places').doc(placeId).collection('auraHistory');

  @override
  Future<void> recordSnapshot(AuraHistoryEntry entry) async {
    await _collection(entry.placeId)
        .doc(entry.id)
        .set(AuraHistoryEntryDto.fromDomain(entry).toMap());
  }

  @override
  Stream<List<AuraHistoryEntry>> watchAuraHistory(
    String placeId, {
    int limit = 30,
  }) {
    return _collection(placeId)
        .orderBy('recordedAt', descending: true)
        .limit(limit)
        .snapshots()
        .map((snapshot) {
          return snapshot.docs
              .map(
                (doc) =>
                    AuraHistoryEntryDto.fromMap(doc.id, doc.data()).toDomain(),
              )
              .toList();
        });
  }
}
