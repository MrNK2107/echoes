import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';

class Memory {
  const Memory({
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
  }) : assert(textContent.length >= 1 && textContent.length <= 2000),
       assert(latitude >= -90 && latitude <= 90),
       assert(longitude >= -180 && longitude <= 180);

  final String id;
  final String userId;
  final String placeId;
  final String? imageUrl;
  final String? audioUrl;
  final String textContent;
  final double latitude;
  final double longitude;
  final String geohash;
  final SentimentResult sentiment;
  final PrivacyType privacy;
  final List<String> taggedUserIds;
  final String? communityId;
  final DateTime? releaseDate;
  final bool isDeleted;
  final DateTime? deletedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool isVisibleTo({
    required String viewerId,
    required bool viewerIsCommunityMember,
    required DateTime now,
  }) {
    if (isDeleted) {
      return false;
    }
    if (viewerId == userId) {
      return true;
    }

    return switch (privacy) {
      PrivacyType.public => true,
      PrivacyType.private => false,
      PrivacyType.tagged => taggedUserIds.contains(viewerId),
      PrivacyType.timeRelease =>
        releaseDate != null && !now.isBefore(releaseDate!),
      PrivacyType.community => viewerIsCommunityMember,
    };
  }
}
