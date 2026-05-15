import 'package:echoes/features/communities/data/local_community_repository.dart';
import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_role.dart';
import 'package:echoes/features/communities/domain/community_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LocalCommunityRepository', () {
    test('creates thematic community and includes owner membership', () async {
      final now = DateTime.utc(2026, 5, 14);
      final repository = LocalCommunityRepository(now: now);
      final community = Community(
        id: 'travel-memories',
        name: 'Travel Memories',
        description: 'Places remembered from long journeys.',
        type: CommunityType.thematic,
        ownerId: 'user-1',
        memberCount: 1,
        createdAt: now,
        updatedAt: now,
      );

      await repository.create(community);

      final userCommunities = await repository
          .watchUserCommunities('user-1')
          .first;
      final membership = await repository.findMembership(
        communityId: community.id,
        userId: 'user-1',
      );

      expect(
        userCommunities.map((community) => community.id),
        contains('travel-memories'),
      );
      expect(membership?.role, CommunityRole.owner);
      repository.dispose();
    });

    test('join adds user to community membership', () async {
      final repository = LocalCommunityRepository(
        now: DateTime.utc(2026, 5, 14),
      );

      await repository.join(
        communityId: 'campus-keepers',
        userId: 'new-member',
        role: CommunityRole.member,
      );

      expect(
        repository.isMember(
          communityId: 'campus-keepers',
          userId: 'new-member',
        ),
        isTrue,
      );
      expect(
        (await repository.findMembership(
          communityId: 'campus-keepers',
          userId: 'new-member',
        ))?.role,
        CommunityRole.member,
      );
      repository.dispose();
    });

    test('join preserves guardian and visitor roles', () async {
      final repository = LocalCommunityRepository(
        now: DateTime.utc(2026, 5, 14),
      );

      await repository.join(
        communityId: 'campus-keepers',
        userId: 'new-guardian',
        role: CommunityRole.guardian,
      );
      await repository.join(
        communityId: 'campus-keepers',
        userId: 'new-visitor',
        role: CommunityRole.visitor,
      );

      final guardian = await repository.findMembership(
        communityId: 'campus-keepers',
        userId: 'new-guardian',
      );
      final visitor = await repository.findMembership(
        communityId: 'campus-keepers',
        userId: 'new-visitor',
      );

      expect(guardian?.role, CommunityRole.guardian);
      expect(visitor?.role, CommunityRole.visitor);
      repository.dispose();
    });
  });
}
