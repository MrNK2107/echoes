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

  @override
  Future<void> notifyTransferAccepted({
    required String transferId,
    required String placeId,
    required String fromUserId,
    required String toUserId,
  }) {
    return _requests.doc('transfer-accepted-$transferId').set({
      'type': NotificationDeliveryType.transferAccepted.name,
      'recipientUserId': fromUserId,
      'title': 'Custodianship accepted',
      'body': '$toUserId accepted your custodianship transfer.',
      'data': {
        'type': NotificationDeliveryType.transferAccepted.name,
        'transferId': transferId,
        'placeId': placeId,
        'fromUserId': fromUserId,
        'toUserId': toUserId,
      },
      'createdAt': FieldValue.serverTimestamp(),
      'status': 'pending',
    });
  }

  @override
  Future<void> notifyMemoryTagged({
    required String memoryId,
    required String placeId,
    required String fromUserId,
    required List<String> taggedUserIds,
  }) async {
    final batch = _firestore.batch();
    for (final taggedUserId in taggedUserIds.toSet()) {
      if (taggedUserId == fromUserId) {
        continue;
      }
      batch.set(_requests.doc('memory-tagged-$memoryId-$taggedUserId'), {
        'type': NotificationDeliveryType.memoryTagged.name,
        'recipientUserId': taggedUserId,
        'title': 'Tagged in a memory',
        'body': '$fromUserId tagged you in a memory.',
        'data': {
          'type': NotificationDeliveryType.memoryTagged.name,
          'memoryId': memoryId,
          'placeId': placeId,
          'fromUserId': fromUserId,
          'toUserId': taggedUserId,
        },
        'createdAt': FieldValue.serverTimestamp(),
        'status': 'pending',
      });
    }
    await batch.commit();
  }
}
