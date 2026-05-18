import 'package:echoes/features/notifications/domain/notification_delivery.dart';
import 'package:echoes/features/notifications/domain/notification_delivery_service.dart';

class LocalNotificationDeliveryService implements NotificationDeliveryService {
  LocalNotificationDeliveryService({DateTime? now}) : _now = now;

  final DateTime? _now;
  final List<NotificationDelivery> _deliveries = [];

  List<NotificationDelivery> get deliveries => List.unmodifiable(_deliveries);

  @override
  Future<void> notifyTransferRequest({
    required String transferId,
    required String placeId,
    required String fromUserId,
    required String toUserId,
  }) async {
    _deliveries.add(
      NotificationDelivery(
        id: 'transfer-request-$transferId',
        type: NotificationDeliveryType.transferRequest,
        recipientUserId: toUserId,
        title: 'Custodianship request',
        body: '$fromUserId invited you to become a place custodian.',
        data: {
          'type': NotificationDeliveryType.transferRequest.name,
          'transferId': transferId,
          'placeId': placeId,
          'fromUserId': fromUserId,
          'toUserId': toUserId,
        },
        createdAt: _now ?? DateTime.now().toUtc(),
      ),
    );
  }

  @override
  Future<void> notifyTransferAccepted({
    required String transferId,
    required String placeId,
    required String fromUserId,
    required String toUserId,
  }) async {
    _deliveries.add(
      NotificationDelivery(
        id: 'transfer-accepted-$transferId',
        type: NotificationDeliveryType.transferAccepted,
        recipientUserId: fromUserId,
        title: 'Custodianship accepted',
        body: '$toUserId accepted your custodianship transfer.',
        data: {
          'type': NotificationDeliveryType.transferAccepted.name,
          'transferId': transferId,
          'placeId': placeId,
          'fromUserId': fromUserId,
          'toUserId': toUserId,
        },
        createdAt: _now ?? DateTime.now().toUtc(),
      ),
    );
  }

  @override
  Future<void> notifyMemoryTagged({
    required String memoryId,
    required String placeId,
    required String fromUserId,
    required List<String> taggedUserIds,
  }) async {
    for (final taggedUserId in taggedUserIds.toSet()) {
      if (taggedUserId == fromUserId) {
        continue;
      }
      _deliveries.add(
        NotificationDelivery(
          id: 'memory-tagged-$memoryId-$taggedUserId',
          type: NotificationDeliveryType.memoryTagged,
          recipientUserId: taggedUserId,
          title: 'Tagged in a memory',
          body: '$fromUserId tagged you in a memory.',
          data: {
            'type': NotificationDeliveryType.memoryTagged.name,
            'memoryId': memoryId,
            'placeId': placeId,
            'fromUserId': fromUserId,
            'toUserId': taggedUserId,
          },
          createdAt: _now ?? DateTime.now().toUtc(),
        ),
      );
    }
  }

  @override
  Future<void> notifyCommunityInvitation({
    required String communityId,
    required String communityName,
    required String fromUserId,
    required List<String> invitedUserIds,
  }) async {
    for (final invitedUserId in invitedUserIds.toSet()) {
      if (invitedUserId == fromUserId) {
        continue;
      }
      _deliveries.add(
        NotificationDelivery(
          id: 'community-invitation-$communityId-$invitedUserId',
          type: NotificationDeliveryType.communityInvitation,
          recipientUserId: invitedUserId,
          title: 'Community invitation',
          body: '$fromUserId invited you to join $communityName.',
          data: {
            'type': NotificationDeliveryType.communityInvitation.name,
            'communityId': communityId,
            'communityName': communityName,
            'fromUserId': fromUserId,
            'toUserId': invitedUserId,
          },
          createdAt: _now ?? DateTime.now().toUtc(),
        ),
      );
    }
  }
}
