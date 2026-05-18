import 'package:equatable/equatable.dart';

class PushNotificationMessage extends Equatable {
  const PushNotificationMessage({
    required this.id,
    required this.data,
    this.title,
    this.body,
    this.sentAt,
  });

  final String id;
  final String? title;
  final String? body;
  final Map<String, String> data;
  final DateTime? sentAt;

  @override
  List<Object?> get props => [id, title, body, data, sentAt];
}
