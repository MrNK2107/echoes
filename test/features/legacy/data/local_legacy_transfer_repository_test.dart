import 'package:echoes/features/legacy/data/local_legacy_transfer_repository.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer.dart';
import 'package:echoes/features/legacy/domain/transfer_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LocalLegacyTransferRepository', () {
    test('watches pending transfers for recipient', () async {
      final repository = LocalLegacyTransferRepository();
      final now = DateTime.utc(2026, 5, 14);

      await repository.initiate(
        LegacyTransfer(
          id: 'transfer-1',
          placeId: 'place-1',
          fromUserId: 'custodian',
          toUserId: 'recipient',
          status: TransferStatus.pending,
          createdAt: now,
          revokeUntil: now.add(const Duration(days: 7)),
        ),
      );

      final pending = await repository
          .watchPendingTransfersForUser('recipient')
          .first;

      expect(pending, hasLength(1));
      repository.dispose();
    });

    test(
      'accept moves transfer out of pending list and records history',
      () async {
        final repository = LocalLegacyTransferRepository();
        final now = DateTime.utc(2026, 5, 14);

        await repository.initiate(
          LegacyTransfer(
            id: 'transfer-1',
            placeId: 'place-1',
            fromUserId: 'custodian',
            toUserId: 'recipient',
            status: TransferStatus.pending,
            createdAt: now,
            revokeUntil: now.add(const Duration(days: 7)),
          ),
        );
        await repository.accept('transfer-1');

        final pending = await repository
            .watchPendingTransfersForUser('recipient')
            .first;

        expect(pending, isEmpty);
        expect(
          repository.transferHistory().single.status,
          TransferStatus.accepted,
        );
        expect(repository.transferHistory().single.acceptedAt, isNotNull);
        repository.dispose();
      },
    );
  });
}
