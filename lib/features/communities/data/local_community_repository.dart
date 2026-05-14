import 'dart:async';

import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/communities/domain/community_role.dart';
import 'package:echoes/features/communities/domain/community_type.dart';

class LocalCommunityRepository implements CommunityRepository {
  LocalCommunityRepository({DateTime? now})
    : _communities = _seedCommunities(now ?? DateTime.now().toUtc());

  final List<Community> _communities;
  final Map<String, Set<String>> _membersByCommunityId = {
    'campus-keepers': {'local-custodian', 'nanda@example.com'},
  };
  final _controller = StreamController<List<Community>>.broadcast();

  @override
  Future<void> create(Community community) async {
    _communities.add(community);
    _membersByCommunityId.putIfAbsent(community.id, () => {community.ownerId});
    _controller.add(List.unmodifiable(_communities));
  }

  @override
  Future<Community?> findById(String id) async {
    return _communities.where((community) => community.id == id).firstOrNull;
  }

  @override
  Future<void> join({
    required String communityId,
    required String userId,
    required CommunityRole role,
  }) async {
    _membersByCommunityId.putIfAbsent(communityId, () => {}).add(userId);
  }

  @override
  Stream<List<Community>> watchUserCommunities(String userId) async* {
    yield _communities
        .where((community) => _isMember(community.id, userId))
        .toList();
    yield* _controller.stream.map(
      (communities) => communities
          .where((community) => _isMember(community.id, userId))
          .toList(),
    );
  }

  bool isMember({required String communityId, required String userId}) {
    return _isMember(communityId, userId);
  }

  bool _isMember(String communityId, String userId) {
    return _membersByCommunityId[communityId]?.contains(userId) ?? false;
  }

  void dispose() {
    _controller.close();
  }

  static List<Community> _seedCommunities(DateTime now) {
    return [
      Community(
        id: 'campus-keepers',
        name: 'Campus Keepers',
        description: 'Shared memories from campus courtyards and classrooms.',
        type: CommunityType.thematic,
        ownerId: 'local-custodian',
        memberCount: 1,
        createdAt: now,
        updatedAt: now,
      ),
    ];
  }
}
