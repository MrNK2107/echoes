import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/communities/domain/community_type.dart';
import 'package:echoes/features/memories/domain/memory.dart';

class TimeBasedCommunityService {
  const TimeBasedCommunityService({
    required CommunityRepository communityRepository,
  }) : _communityRepository = communityRepository;

  final CommunityRepository _communityRepository;

  Future<void> ensureForMemory({
    required Memory memory,
    required DateTime now,
  }) async {
    final year = memory.createdAt.toUtc().year;
    final communityId = 'time-$year';
    final existing = await _communityRepository.findById(communityId);
    if (existing != null) {
      return;
    }

    await _communityRepository.create(
      Community(
        id: communityId,
        name: '$year Memories',
        description: 'Auto-created for memories saved during $year.',
        type: CommunityType.timeBased,
        ownerId: memory.userId,
        memberCount: 1,
        createdAt: now,
        updatedAt: now,
      ),
    );
  }
}
