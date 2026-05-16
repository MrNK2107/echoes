import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/legacy/data/legacy_transfer_dto.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer_repository.dart';
import 'package:echoes/features/legacy/domain/transfer_status.dart';

class FirestoreLegacyTransferRepository implements LegacyTransferRepository {
  FirestoreLegacyTransferRepository({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _collection =>
      _firestore.collection('transfers');

  @override
  Future<void> accept(String transferId) {
    return _collection.doc(transferId).update({
      'status': TransferStatus.accepted.name,
      'acceptedAt': DateTime.now().toUtc().toIso8601String(),
    });
  }

  @override
  Future<void> initiate(LegacyTransfer transfer) {
    return _collection
        .doc(transfer.id)
        .set(LegacyTransferDto.fromDomain(transfer).toMap());
  }

  @override
  Future<void> reject(String transferId) {
    return _collection.doc(transferId).update({
      'status': TransferStatus.rejected.name,
    });
  }

  @override
  Future<void> revoke(String transferId) async {
    final snapshot = await _collection.doc(transferId).get();
    final data = snapshot.data();
    if (data == null) {
      return;
    }

    final transfer = LegacyTransferDto.fromMap(snapshot.id, data).toDomain();
    final now = DateTime.now().toUtc();
    if (!transfer.canBeRevokedAt(now)) {
      return;
    }

    await _collection.doc(transferId).update({
      'status': TransferStatus.revoked.name,
      'revokedAt': now.toIso8601String(),
    });
  }

  @override
  Stream<List<LegacyTransfer>> watchPendingTransfersForUser(String userId) {
    return _collection
        .where('toUserId', isEqualTo: userId)
        .where('status', isEqualTo: TransferStatus.pending.name)
        .snapshots()
        .map((snapshot) {
          return snapshot.docs
              .map(
                (doc) => LegacyTransferDto.fromMap(doc.id, doc.data()).toDomain(),
              )
              .toList();
        });
  }
}
