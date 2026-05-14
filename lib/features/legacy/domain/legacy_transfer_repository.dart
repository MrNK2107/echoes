import 'package:echoes/features/legacy/domain/legacy_transfer.dart';

abstract interface class LegacyTransferRepository {
  Stream<List<LegacyTransfer>> watchPendingTransfersForUser(String userId);

  Future<void> initiate(LegacyTransfer transfer);

  Future<void> accept(String transferId);

  Future<void> reject(String transferId);

  Future<void> revoke(String transferId);
}
