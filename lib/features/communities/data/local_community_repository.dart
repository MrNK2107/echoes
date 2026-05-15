import 'dart:async';

import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_membership.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/communities/domain/community_role.dart';
import 'package:echoes/features/communities/domain/community_type.dart';

class LocalCommunityRepository implements CommunityRepository {
  LocalCommunityRepository({DateTime? now})
    : _now = now ?? DateTime.now().toUtc(),
      _communities = _seedCommunities(now ?? DateTime.now().toUtc()) {
    _membershipsByCommunityId.addAll(_seedMemberships(_now));
  }

  final DateTime _now;
  final List<Community> _communities;
  final Map<String, Map<String, CommunityMembership>>
  _membershipsByCommunityId = {};
  final _controller = StreamController<List<Community>>.broadcast();

  @override
  Future<void> create(Community community) async {
    _communities.add(community);
    _membershipsByCommunityId.putIfAbsent(community.id, () => {});
    _membershipsByCommunityId[community.id]![community.ownerId] =
        CommunityMembership(
          communityId: community.id,
          userId: community.ownerId,
          role: CommunityRole.owner,
          joinedAt: community.createdAt,
          updatedAt: community.createdAt,
        );
    _controller.add(List.unmodifiable(_communities));
  }

  @override
  Future<Community?> findById(String id) async {
    return _communities.where((community) => community.id == id).firstOrNull;
  }

  @override
  Future<CommunityMembership?> findMembership({
    required String communityId,
    required String userId,
  }) async {
    return _membershipsByCommunityId[communityId]?[userId];
  }

  @override
  Future<void> join({
    required String communityId,
    required String userId,
    required CommunityRole role,
  }) async {
    final memberships = _membershipsByCommunityId.putIfAbsent(
      communityId,
      () => {},
    );
    final existing = memberships[userId];
    memberships[userId] = CommunityMembership(
      communityId: communityId,
      userId: userId,
      role: role,
      joinedAt: existing?.joinedAt ?? _now,
      updatedAt: _now,
    );
  }

  @override
  Stream<List<Community>> watchCommunities() async* {
    yield List.unmodifiable(_communities);
    yield* _controller.stream;
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
    return _membershipsByCommunityId[communityId]?.containsKey(userId) ?? false;
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

  static Map<String, Map<String, CommunityMembership>> _seedMemberships(
    DateTime now,
  ) {
    return {
      'campus-keepers': {
        'local-custodian': CommunityMembership(
          communityId: 'campus-keepers',
          userId: 'local-custodian',
          role: CommunityRole.owner,
          joinedAt: now,
          updatedAt: now,
        ),
        'nanda@example.com': CommunityMembership(
          communityId: 'campus-keepers',
          userId: 'nanda@example.com',
          role: CommunityRole.member,
          joinedAt: now,
          updatedAt: now,
        ),
      },
    };
  }
}
