import 'package:echoes/core/geo/geohash.dart';
import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/legacy/application/custodianship_transfer_service.dart';
import 'package:echoes/features/legacy/data/local_legacy_transfer_repository.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer.dart';
import 'package:echoes/features/legacy/domain/transfer_status.dart';
import 'package:echoes/features/notifications/data/local_notification_delivery_service.dart';
import 'package:echoes/features/notifications/domain/notification_delivery.dart';
import 'package:echoes/features/places/data/local_place_repository.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CustodianshipTransferService', () {
    test(
      'accepting transfer adds recipient as an additional custodian',
      () async {
        final now = DateTime.utc(2026, 5, 16);
        final placeRepository = LocalPlaceRepository(now: now);
        final transferRepository = LocalLegacyTransferRepository();
        final notificationDeliveryService = LocalNotificationDeliveryService();
        final service = CustodianshipTransferService(
          transferRepository: transferRepository,
          placeRepository: placeRepository,
          notificationDeliveryService: notificationDeliveryService,
        );

        await placeRepository.save(
          _place(now: now, custodianIds: const ['original-custodian']),
        );
        await transferRepository.initiate(
          LegacyTransfer(
            id: 'transfer-1',
            placeId: 'place-1',
            fromUserId: 'original-custodian',
            toUserId: 'recipient',
            status: TransferStatus.pending,
            createdAt: now,
            revokeUntil: now.add(const Duration(days: 7)),
          ),
        );

        await service.acceptTransfer('transfer-1');

        final place = await placeRepository.findById('place-1');
        expect(
          place?.custodianIds,
          containsAllInOrder(['original-custodian', 'recipient']),
        );
        expect(
          transferRepository.transferHistory().single.status,
          TransferStatus.accepted,
        );
        final delivery = notificationDeliveryService.deliveries.single;
        expect(delivery.type, NotificationDeliveryType.transferAccepted);
        expect(delivery.recipientUserId, 'original-custodian');
        expect(delivery.data['transferId'], 'transfer-1');

        transferRepository.dispose();
      },
    );

    test(
      'accepting transfer does not duplicate an existing custodian',
      () async {
        final now = DateTime.utc(2026, 5, 16);
        final placeRepository = LocalPlaceRepository(now: now);
        final transferRepository = LocalLegacyTransferRepository();
        final notificationDeliveryService = LocalNotificationDeliveryService();
        final service = CustodianshipTransferService(
          transferRepository: transferRepository,
          placeRepository: placeRepository,
          notificationDeliveryService: notificationDeliveryService,
        );

        await placeRepository.save(
          _place(
            now: now,
            custodianIds: const ['original-custodian', 'recipient'],
          ),
        );
        await transferRepository.initiate(
          LegacyTransfer(
            id: 'transfer-1',
            placeId: 'place-1',
            fromUserId: 'original-custodian',
            toUserId: 'recipient',
            status: TransferStatus.pending,
            createdAt: now,
            revokeUntil: now.add(const Duration(days: 7)),
          ),
        );

        await service.acceptTransfer('transfer-1');

        final place = await placeRepository.findById('place-1');
        expect(
          place?.custodianIds.where((id) => id == 'recipient'),
          hasLength(1),
        );
        expect(
          notificationDeliveryService.deliveries.single.type,
          NotificationDeliveryType.transferAccepted,
        );

        transferRepository.dispose();
      },
    );

    test('initiating transfer notifies the recipient', () async {
      final now = DateTime.utc(2026, 5, 18);
      final transferRepository = LocalLegacyTransferRepository();
      final placeRepository = LocalPlaceRepository(now: now);
      final notificationDeliveryService = LocalNotificationDeliveryService(
        now: now,
      );
      final service = CustodianshipTransferService(
        transferRepository: transferRepository,
        placeRepository: placeRepository,
        notificationDeliveryService: notificationDeliveryService,
      );

      await service.initiateTransfer(
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

      expect(transferRepository.transferHistory().single.id, 'transfer-1');
      final delivery = notificationDeliveryService.deliveries.single;
      expect(delivery.type, NotificationDeliveryType.transferRequest);
      expect(delivery.recipientUserId, 'recipient');
      expect(delivery.data['transferId'], 'transfer-1');

      transferRepository.dispose();
    });
  });
}

Place _place({required DateTime now, required List<String> custodianIds}) {
  return Place(
    id: 'place-1',
    name: 'Library Steps',
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: Geohash.encode(latitude: 12.9716, longitude: 77.5946),
    custodianIds: custodianIds,
    aura: AuraZone.empty(now),
    memoryCount: 1,
    publicMemoryCount: 1,
    createdAt: now,
    updatedAt: now,
  );
}
