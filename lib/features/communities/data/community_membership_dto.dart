import 'package:echoes/features/communities/domain/community_membership.dart';
import 'package:echoes/features/communities/domain/community_role.dart';

class CommunityMembershipDto {
  const CommunityMembershipDto({
    required this.communityId,
    required this.userId,
    required this.role,
    required this.joinedAt,
    required this.updatedAt,
  });

  factory CommunityMembershipDto.fromDomain(CommunityMembership membership) {
    return CommunityMembershipDto(
      communityId: membership.communityId,
      userId: membership.userId,
      role: membership.role.name,
      joinedAt: membership.joinedAt,
      updatedAt: membership.updatedAt,
    );
  }

  factory CommunityMembershipDto.fromMap(
    String communityId,
    String userId,
    Map<String, Object?> map,
  ) {
    return CommunityMembershipDto(
      communityId: communityId,
      userId: userId,
      role: map['role']! as String,
      joinedAt: DateTime.parse(map['joinedAt']! as String),
      updatedAt: DateTime.parse(map['updatedAt']! as String),
    );
  }

  final String communityId;
  final String userId;
  final String role;
  final DateTime joinedAt;
  final DateTime updatedAt;

  CommunityMembership toDomain() {
    return CommunityMembership(
      communityId: communityId,
      userId: userId,
      role: CommunityRole.values.byName(role),
      joinedAt: joinedAt,
      updatedAt: updatedAt,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'role': role,
      'joinedAt': joinedAt.toUtc().toIso8601String(),
      'updatedAt': updatedAt.toUtc().toIso8601String(),
    };
  }
}
