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
    await _ensureCommunity(
      id: 'time-$year',
      name: '$year Memories',
      description: 'Auto-created for memories saved during $year.',
      ownerId: memory.userId,
      now: now,
    );

    final decadeStart = (year ~/ 10) * 10;
    await _ensureCommunity(
      id: 'era-${decadeStart}s',
      name: '${decadeStart}s Era',
      description:
          'Auto-created for memories saved from $decadeStart to ${decadeStart + 9}.',
      ownerId: memory.userId,
      now: now,
    );
  }

  Future<void> _ensureCommunity({
    required String id,
    required String name,
    required String description,
    required String ownerId,
    required DateTime now,
  }) async {
    final communityId = id;
    final existing = await _communityRepository.findById(communityId);
    if (existing != null) {
      return;
    }

    await _communityRepository.create(
      Community(
        id: communityId,
        name: name,
        description: description,
        type: CommunityType.timeBased,
        ownerId: ownerId,
        memberCount: 1,
        createdAt: now,
        updatedAt: now,
      ),
    );
  }
}
