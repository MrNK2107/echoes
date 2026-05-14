import 'package:echoes/features/legacy/domain/legacy_transfer.dart';
import 'package:echoes/features/legacy/domain/transfer_status.dart';

class LegacyTransferDto {
  const LegacyTransferDto({
    required this.id,
    required this.placeId,
    required this.fromUserId,
    required this.toUserId,
    required this.status,
    required this.createdAt,
    required this.revokeUntil,
    this.acceptedAt,
    this.revokedAt,
  });

  factory LegacyTransferDto.fromDomain(LegacyTransfer transfer) {
    return LegacyTransferDto(
      id: transfer.id,
      placeId: transfer.placeId,
      fromUserId: transfer.fromUserId,
      toUserId: transfer.toUserId,
      status: transfer.status.name,
      createdAt: transfer.createdAt,
      revokeUntil: transfer.revokeUntil,
      acceptedAt: transfer.acceptedAt,
      revokedAt: transfer.revokedAt,
    );
  }

  factory LegacyTransferDto.fromMap(String id, Map<String, Object?> map) {
    return LegacyTransferDto(
      id: id,
      placeId: map['placeId']! as String,
      fromUserId: map['fromUserId']! as String,
      toUserId: map['toUserId']! as String,
      status: map['status']! as String,
      createdAt: DateTime.parse(map['createdAt']! as String),
      revokeUntil: DateTime.parse(map['revokeUntil']! as String),
      acceptedAt: _optionalDate(map['acceptedAt']),
      revokedAt: _optionalDate(map['revokedAt']),
    );
  }

  final String id;
  final String placeId;
  final String fromUserId;
  final String toUserId;
  final String status;
  final DateTime createdAt;
  final DateTime revokeUntil;
  final DateTime? acceptedAt;
  final DateTime? revokedAt;

  LegacyTransfer toDomain() {
    return LegacyTransfer(
      id: id,
      placeId: placeId,
      fromUserId: fromUserId,
      toUserId: toUserId,
      status: TransferStatus.values.byName(status),
      createdAt: createdAt,
      revokeUntil: revokeUntil,
      acceptedAt: acceptedAt,
      revokedAt: revokedAt,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'placeId': placeId,
      'fromUserId': fromUserId,
      'toUserId': toUserId,
      'status': status,
      'createdAt': createdAt.toUtc().toIso8601String(),
      'revokeUntil': revokeUntil.toUtc().toIso8601String(),
      'acceptedAt': acceptedAt?.toUtc().toIso8601String(),
      'revokedAt': revokedAt?.toUtc().toIso8601String(),
    };
  }

  static DateTime? _optionalDate(Object? value) {
    return value == null ? null : DateTime.parse(value as String);
  }
}
