abstract interface class NotificationDeliveryService {
  Future<void> notifyTransferRequest({
    required String transferId,
    required String placeId,
    required String fromUserId,
    required String toUserId,
  });

  Future<void> notifyTransferAccepted({
    required String transferId,
    required String placeId,
    required String fromUserId,
    required String toUserId,
  });

  Future<void> notifyMemoryTagged({
    required String memoryId,
    required String placeId,
    required String fromUserId,
    required List<String> taggedUserIds,
  });

  Future<void> notifyCommunityInvitation({
    required String communityId,
    required String communityName,
    required String fromUserId,
    required List<String> invitedUserIds,
  });
}
