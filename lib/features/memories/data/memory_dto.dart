import 'package:echoes/features/aura/data/sentiment_result_dto.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';

class MemoryDto {
  const MemoryDto({
    required this.id,
    required this.userId,
    required this.placeId,
    required this.textContent,
    required this.latitude,
    required this.longitude,
    required this.geohash,
    required this.sentiment,
    required this.privacy,
    required this.taggedUserIds,
    required this.isDeleted,
    required this.createdAt,
    required this.updatedAt,
    this.imageUrl,
    this.audioUrl,
    this.communityId,
    this.releaseDate,
    this.deletedAt,
  });

  factory MemoryDto.fromDomain(Memory memory) {
    return MemoryDto(
      id: memory.id,
      userId: memory.userId,
      placeId: memory.placeId,
      imageUrl: memory.imageUrl,
      audioUrl: memory.audioUrl,
      textContent: memory.textContent,
      latitude: memory.latitude,
      longitude: memory.longitude,
      geohash: memory.geohash,
      sentiment: SentimentResultDto.fromDomain(memory.sentiment),
      privacy: memory.privacy.name,
      taggedUserIds: memory.taggedUserIds,
      communityId: memory.communityId,
      releaseDate: memory.releaseDate,
      isDeleted: memory.isDeleted,
      deletedAt: memory.deletedAt,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    );
  }

  factory MemoryDto.fromMap(String id, Map<String, Object?> map) {
    return MemoryDto(
      id: id,
      userId: map['userId']! as String,
      placeId: map['placeId']! as String,
      imageUrl: map['imageUrl'] as String?,
      audioUrl: map['audioUrl'] as String?,
      textContent: map['textContent']! as String,
      latitude: (map['latitude']! as num).toDouble(),
      longitude: (map['longitude']! as num).toDouble(),
      geohash: map['geohash']! as String,
      sentiment: SentimentResultDto.fromMap(
        map['sentiment']! as Map<String, Object?>,
      ),
      privacy: map['privacy']! as String,
      taggedUserIds: List<String>.from(map['taggedUserIds']! as List),
      communityId: map['communityId'] as String?,
      releaseDate: _optionalDate(map['releaseDate']),
      isDeleted: map['isDeleted']! as bool,
      deletedAt: _optionalDate(map['deletedAt']),
      createdAt: DateTime.parse(map['createdAt']! as String),
      updatedAt: DateTime.parse(map['updatedAt']! as String),
    );
  }

  final String id;
  final String userId;
  final String placeId;
  final String? imageUrl;
  final String? audioUrl;
  final String textContent;
  final double latitude;
  final double longitude;
  final String geohash;
  final SentimentResultDto sentiment;
  final String privacy;
  final List<String> taggedUserIds;
  final String? communityId;
  final DateTime? releaseDate;
  final bool isDeleted;
  final DateTime? deletedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  Memory toDomain() {
    return Memory(
      id: id,
      userId: userId,
      placeId: placeId,
      imageUrl: imageUrl,
      audioUrl: audioUrl,
      textContent: textContent,
      latitude: latitude,
      longitude: longitude,
      geohash: geohash,
      sentiment: sentiment.toDomain(),
      privacy: PrivacyType.values.byName(privacy),
      taggedUserIds: taggedUserIds,
      communityId: communityId,
      releaseDate: releaseDate,
      isDeleted: isDeleted,
      deletedAt: deletedAt,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'userId': userId,
      'placeId': placeId,
      'imageUrl': imageUrl,
      'audioUrl': audioUrl,
      'textContent': textContent,
      'latitude': latitude,
      'longitude': longitude,
      'geohash': geohash,
      'sentiment': sentiment.toMap(),
      'privacy': privacy,
      'taggedUserIds': taggedUserIds,
      'communityId': communityId,
      'releaseDate': releaseDate?.toUtc().toIso8601String(),
      'isDeleted': isDeleted,
      'deletedAt': deletedAt?.toUtc().toIso8601String(),
      'createdAt': createdAt.toUtc().toIso8601String(),
      'updatedAt': updatedAt.toUtc().toIso8601String(),
    };
  }

  static DateTime? _optionalDate(Object? value) {
    return value == null ? null : DateTime.parse(value as String);
  }
}
