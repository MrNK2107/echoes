import 'package:echoes/features/legacy/domain/legacy_transfer.dart';
import 'package:echoes/features/legacy/domain/transfer_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LegacyTransfer', () {
    test('pending transfer can be revoked before revoke window closes', () {
      final now = DateTime.utc(2026, 5, 14);
      final transfer = LegacyTransfer(
        id: 'transfer-1',
        placeId: 'place-1',
        fromUserId: 'from-user',
        toUserId: 'to-user',
        status: TransferStatus.pending,
        createdAt: now,
        revokeUntil: now.add(const Duration(days: 7)),
      );

      expect(transfer.canBeRevokedAt(now.add(const Duration(days: 3))), isTrue);
    });

    test('accepted transfer cannot be revoked', () {
      final now = DateTime.utc(2026, 5, 14);
      final transfer = LegacyTransfer(
        id: 'transfer-1',
        placeId: 'place-1',
        fromUserId: 'from-user',
        toUserId: 'to-user',
        status: TransferStatus.accepted,
        createdAt: now,
        revokeUntil: now.add(const Duration(days: 7)),
        acceptedAt: now,
      );

      expect(
        transfer.canBeRevokedAt(now.add(const Duration(days: 1))),
        isFalse,
      );
    });
  });
}
