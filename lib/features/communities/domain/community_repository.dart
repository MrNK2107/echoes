import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_role.dart';

abstract interface class CommunityRepository {
  Stream<List<Community>> watchCommunities();

  Stream<List<Community>> watchUserCommunities(String userId);

  Future<Community?> findById(String id);

  Future<void> create(Community community);

  Future<void> join({
    required String communityId,
    required String userId,
    required CommunityRole role,
  });
}
