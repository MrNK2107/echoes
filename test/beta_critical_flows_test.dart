import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/communities/data/local_community_repository.dart';
import 'package:echoes/features/communities/domain/community_role.dart';
import 'package:echoes/features/legacy/application/custodianship_transfer_service.dart';
import 'package:echoes/features/legacy/data/local_legacy_transfer_repository.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer.dart';
import 'package:echoes/features/legacy/domain/transfer_status.dart';
import 'package:echoes/features/memories/data/local_memory_repository.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/notifications/data/local_notification_delivery_service.dart';
import 'package:echoes/features/notifications/domain/notification_delivery.dart';
import 'package:echoes/features/places/data/local_place_repository.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('beta critical flows', () {
    test('creates, edits, and soft-deletes a memory', () async {
      final repository = LocalMemoryRepository();
      final now = DateTime.utc(2026, 5, 18, 8);

      await repository.create(_memory(createdAt: now));

      var saved = await repository.findById('memory-1');
      expect(saved?.textContent, 'First evening under the rain tree');
      expect(saved?.privacy, PrivacyType.public);

      await repository.updateTextAndPrivacy(
        memoryId: 'memory-1',
        textContent: 'Edited for beta smoke coverage',
        privacy: PrivacyType.tagged,
        taggedUserIds: const ['beta-friend'],
        releaseDate: null,
        communityId: null,
      );

      saved = await repository.findById('memory-1');
      expect(saved?.textContent, 'Edited for beta smoke coverage');
      expect(saved?.privacy, PrivacyType.tagged);
      expect(saved?.taggedUserIds, contains('beta-friend'));
      expect(saved?.latitude, 12.9716);
      expect(saved?.longitude, 77.5946);
      expect(saved?.createdAt, now);

      await repository.softDelete(
        memoryId: 'memory-1',
        deletedAt: DateTime.utc(2026, 5, 18, 9),
      );

      saved = await repository.findById('memory-1');
      expect(saved?.isDeleted, isTrue);
      expect(await repository.watchMemoriesForUser('creator').first, isEmpty);
    });

    test('joins a community and sees community-scoped memories', () async {
      final communities = LocalCommunityRepository(
        now: DateTime.utc(2026, 5, 18),
      );
      final memories = LocalMemoryRepository();

      await communities.join(
        communityId: 'campus-keepers',
        userId: 'beta-member',
        role: CommunityRole.member,
      );
      expect(
        await communities.findMembership(
          communityId: 'campus-keepers',
          userId: 'beta-member',
        ),
        isNotNull,
      );

      await memories.create(
        _memory(
          id: 'community-memory',
          privacy: PrivacyType.community,
          communityId: 'campus-keepers',
        ),
      );

      final betaVisible = await memories
          .watchVisibleMemoriesForPlace(
            placeId: 'college-courtyard',
            viewerId: 'beta-member',
            viewerCommunityIds: const {'campus-keepers'},
            now: DateTime.utc(2026, 5, 18),
          )
          .first;
      final outsiderVisible = await memories
          .watchVisibleMemoriesForPlace(
            placeId: 'college-courtyard',
            viewerId: 'outsider',
            viewerCommunityIds: const {},
            now: DateTime.utc(2026, 5, 18),
          )
          .first;

      expect(betaVisible.single.id, 'community-memory');
      expect(outsiderVisible, isEmpty);
    });

    test('transfers custodianship and emits beta notifications', () async {
      final places = LocalPlaceRepository(now: DateTime.utc(2026, 5, 18));
      final transfers = LocalLegacyTransferRepository();
      final notifications = LocalNotificationDeliveryService(
        now: DateTime.utc(2026, 5, 18, 10),
      );
      final service = CustodianshipTransferService(
        transferRepository: transfers,
        placeRepository: places,
        notificationDeliveryService: notifications,
      );

      await service.initiateTransfer(
        LegacyTransfer(
          id: 'transfer-1',
          placeId: 'college-courtyard',
          fromUserId: 'local-custodian',
          toUserId: 'beta-custodian',
          status: TransferStatus.pending,
          createdAt: DateTime.utc(2026, 5, 18, 10),
          revokeUntil: DateTime.utc(2026, 5, 25, 10),
        ),
      );

      expect(
        notifications.deliveries.single.type,
        NotificationDeliveryType.transferRequest,
      );

      await service.acceptTransfer('transfer-1');

      final accepted = await transfers.findById('transfer-1');
      final place = await places.findById('college-courtyard');

      expect(accepted?.status, TransferStatus.accepted);
      expect(place?.custodianIds, contains('beta-custodian'));
      expect(
        notifications.deliveries.map((delivery) => delivery.type),
        containsAll([
          NotificationDeliveryType.transferRequest,
          NotificationDeliveryType.transferAccepted,
        ]),
      );
    });
  });
}

Memory _memory({
  String id = 'memory-1',
  PrivacyType privacy = PrivacyType.public,
  String? communityId,
  DateTime? createdAt,
}) {
  final now = createdAt ?? DateTime.utc(2026, 5, 18, 8);

  return Memory(
    id: id,
    userId: 'creator',
    placeId: 'college-courtyard',
    textContent: 'First evening under the rain tree',
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: 'tdr1v',
    sentiment: const SentimentResult(
      compound: 0.42,
      positive: 0.5,
      neutral: 0.45,
      negative: 0.05,
    ),
    privacy: privacy,
    taggedUserIds: const [],
    communityId: communityId,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  );
}
