import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';

abstract interface class MemoryRepository {
  Stream<List<Memory>> watchMemoriesForPlace(String placeId);

  Stream<List<Memory>> watchVisibleMemoriesForPlace({
    required String placeId,
    required String viewerId,
    required Set<String> viewerCommunityIds,
    required DateTime now,
  });

  Stream<List<Memory>> watchMemoriesForUser(String userId);

  Future<Memory?> findById(String id);

  Future<void> create(Memory memory);

  Future<void> updateTextAndPrivacy({
    required String memoryId,
    required String textContent,
    required PrivacyType privacy,
    required List<String> taggedUserIds,
    required DateTime? releaseDate,
    required String? communityId,
  });

  Future<void> updateImageUrl({
    required String memoryId,
    required String imageUrl,
    required DateTime updatedAt,
  });

  Future<void> softDelete({
    required String memoryId,
    required DateTime deletedAt,
  });
}
