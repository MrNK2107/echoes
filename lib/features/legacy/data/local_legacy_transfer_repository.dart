import 'dart:async';

import 'package:echoes/features/legacy/domain/legacy_transfer.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer_repository.dart';
import 'package:echoes/features/legacy/domain/transfer_status.dart';

class LocalLegacyTransferRepository implements LegacyTransferRepository {
  final List<LegacyTransfer> _transfers = [];
  final _controller = StreamController<List<LegacyTransfer>>.broadcast();

  @override
  Future<void> accept(String transferId) async {
    _updateStatus(transferId, TransferStatus.accepted);
  }

  @override
  Future<void> initiate(LegacyTransfer transfer) async {
    _transfers.add(transfer);
    _controller.add(List.unmodifiable(_transfers));
  }

  @override
  Future<void> reject(String transferId) async {
    _updateStatus(transferId, TransferStatus.rejected);
  }

  @override
  Future<void> revoke(String transferId) async {
    final index = _transfers.indexWhere(
      (transfer) => transfer.id == transferId,
    );
    if (index == -1 ||
        !_transfers[index].canBeRevokedAt(DateTime.now().toUtc())) {
      return;
    }
    _updateStatus(transferId, TransferStatus.revoked);
  }

  @override
  Stream<List<LegacyTransfer>> watchPendingTransfersForUser(
    String userId,
  ) async* {
    yield _pendingFor(userId);
    yield* _controller.stream.map((_) => _pendingFor(userId));
  }

  List<LegacyTransfer> transferHistory() => List.unmodifiable(_transfers);

  List<LegacyTransfer> _pendingFor(String userId) {
    return _transfers
        .where(
          (transfer) =>
              transfer.toUserId == userId &&
              transfer.status == TransferStatus.pending,
        )
        .toList();
  }

  void _updateStatus(String transferId, TransferStatus status) {
    final index = _transfers.indexWhere(
      (transfer) => transfer.id == transferId,
    );
    if (index == -1) {
      return;
    }

    final current = _transfers[index];
    final now = DateTime.now().toUtc();
    _transfers[index] = LegacyTransfer(
      id: current.id,
      placeId: current.placeId,
      fromUserId: current.fromUserId,
      toUserId: current.toUserId,
      status: status,
      createdAt: current.createdAt,
      revokeUntil: current.revokeUntil,
      acceptedAt: status == TransferStatus.accepted ? now : current.acceptedAt,
      revokedAt: status == TransferStatus.revoked ? now : current.revokedAt,
    );
    _controller.add(List.unmodifiable(_transfers));
  }

  void dispose() {
    _controller.close();
  }
}
