abstract interface class NotificationDeliveryService {
  Future<void> notifyTransferRequest({
    required String transferId,
    required String placeId,
    required String fromUserId,
    required String toUserId,
  });
}
