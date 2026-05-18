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
}
