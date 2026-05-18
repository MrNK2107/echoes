import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/communities/domain/community_type.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';

class GeographicCommunityService {
  const GeographicCommunityService({
    required CommunityRepository communityRepository,
    required PlaceRepository placeRepository,
    this.memoryThreshold = 5,
  }) : _communityRepository = communityRepository,
       _placeRepository = placeRepository;

  final CommunityRepository _communityRepository;
  final PlaceRepository _placeRepository;
  final int memoryThreshold;

  Future<void> ensureForPlace({
    required Place place,
    required String ownerId,
    required DateTime now,
  }) async {
    if (place.communityId != null ||
        place.publicMemoryCount < memoryThreshold) {
      return;
    }

    final communityId = 'geo-${place.id}';
    final existing = await _communityRepository.findById(communityId);
    if (existing == null) {
      await _communityRepository.create(
        Community(
          id: communityId,
          name: '${place.name} Circle',
          description:
              'Auto-created for memories within 100 meters of ${place.name}.',
          type: CommunityType.geographic,
          ownerId: ownerId,
          memberCount: 1,
          createdAt: now,
          updatedAt: now,
        ),
      );
    }

    await _placeRepository.save(
      place.copyWith(communityId: communityId, updatedAt: now),
    );
  }
}
