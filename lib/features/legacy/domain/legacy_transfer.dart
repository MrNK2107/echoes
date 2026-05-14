import 'package:echoes/features/legacy/domain/transfer_status.dart';

class LegacyTransfer {
  const LegacyTransfer({
    required this.id,
    required this.placeId,
    required this.fromUserId,
    required this.toUserId,
    required this.status,
    required this.createdAt,
    required this.revokeUntil,
    this.acceptedAt,
    this.revokedAt,
  });

  final String id;
  final String placeId;
  final String fromUserId;
  final String toUserId;
  final TransferStatus status;
  final DateTime createdAt;
  final DateTime revokeUntil;
  final DateTime? acceptedAt;
  final DateTime? revokedAt;

  bool canBeRevokedAt(DateTime now) {
    return status == TransferStatus.pending && !now.isAfter(revokeUntil);
  }
}
