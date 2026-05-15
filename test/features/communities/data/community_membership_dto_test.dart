import 'package:echoes/features/communities/data/community_membership_dto.dart';
import 'package:echoes/features/communities/domain/community_membership.dart';
import 'package:echoes/features/communities/domain/community_role.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('CommunityMembershipDto round-trips between domain and map', () {
    final now = DateTime.utc(2026, 5, 15);
    final membership = CommunityMembership(
      communityId: 'campus-keepers',
      userId: 'user-1',
      role: CommunityRole.guardian,
      joinedAt: now,
      updatedAt: now,
    );

    final map = CommunityMembershipDto.fromDomain(membership).toMap();
    final restored = CommunityMembershipDto.fromMap(
      membership.communityId,
      membership.userId,
      map,
    ).toDomain();

    expect(restored.communityId, membership.communityId);
    expect(restored.userId, membership.userId);
    expect(restored.role, CommunityRole.guardian);
    expect(restored.joinedAt, now);
  });
}
