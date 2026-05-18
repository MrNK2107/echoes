import 'package:equatable/equatable.dart';

enum NotificationDeliveryType { transferRequest }

class NotificationDelivery extends Equatable {
  const NotificationDelivery({
    required this.id,
    required this.type,
    required this.recipientUserId,
    required this.title,
    required this.body,
    required this.data,
    required this.createdAt,
  });

  final String id;
  final NotificationDeliveryType type;
  final String recipientUserId;
  final String title;
  final String body;
  final Map<String, String> data;
  final DateTime createdAt;

  @override
  List<Object?> get props => [
    id,
    type,
    recipientUserId,
    title,
    body,
    data,
    createdAt,
  ];
}
