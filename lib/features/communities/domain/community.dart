import 'package:echoes/features/communities/domain/community_type.dart';

class Community {
  const Community({
    required this.id,
    required this.name,
    required this.description,
    required this.type,
    required this.ownerId,
    required this.memberCount,
    required this.createdAt,
    required this.updatedAt,
    this.coverImageUrl,
  }) : assert(memberCount >= 0);

  final String id;
  final String name;
  final String description;
  final CommunityType type;
  final String ownerId;
  final String? coverImageUrl;
  final int memberCount;
  final DateTime createdAt;
  final DateTime updatedAt;
}
