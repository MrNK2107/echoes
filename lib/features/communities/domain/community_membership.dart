import 'package:echoes/features/communities/domain/community_role.dart';

class CommunityMembership {
  const CommunityMembership({
    required this.communityId,
    required this.userId,
    required this.role,
    required this.joinedAt,
    required this.updatedAt,
  });

  final String communityId;
  final String userId;
  final CommunityRole role;
  final DateTime joinedAt;
  final DateTime updatedAt;
}
