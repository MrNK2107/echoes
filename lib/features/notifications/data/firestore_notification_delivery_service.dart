import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/notifications/domain/notification_delivery.dart';
import 'package:echoes/features/notifications/domain/notification_delivery_service.dart';

class FirestoreNotificationDeliveryService
    implements NotificationDeliveryService {
  FirestoreNotificationDeliveryService({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _requests =>
      _firestore.collection('notificationRequests');

  @override
  Future<void> notifyTransferRequest({
    required String transferId,
    required String placeId,
    required String fromUserId,
    required String toUserId,
  }) {
    return _requests.doc('transfer-request-$transferId').set({
      'type': NotificationDeliveryType.transferRequest.name,
      'recipientUserId': toUserId,
      'title': 'Custodianship request',
      'body': '$fromUserId invited you to become a place custodian.',
      'data': {
        'type': NotificationDeliveryType.transferRequest.name,
        'transferId': transferId,
        'placeId': placeId,
        'fromUserId': fromUserId,
        'toUserId': toUserId,
      },
      'createdAt': FieldValue.serverTimestamp(),
      'status': 'pending',
    });
  }
}
