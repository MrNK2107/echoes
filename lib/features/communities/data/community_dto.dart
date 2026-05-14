import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_type.dart';

class CommunityDto {
  const CommunityDto({
    required this.id,
    required this.name,
    required this.description,
    required this.type,
    required this.ownerId,
    required this.memberCount,
    required this.createdAt,
    required this.updatedAt,
    this.coverImageUrl,
  });

  factory CommunityDto.fromDomain(Community community) {
    return CommunityDto(
      id: community.id,
      name: community.name,
      description: community.description,
      type: community.type.name,
      ownerId: community.ownerId,
      coverImageUrl: community.coverImageUrl,
      memberCount: community.memberCount,
      createdAt: community.createdAt,
      updatedAt: community.updatedAt,
    );
  }

  factory CommunityDto.fromMap(String id, Map<String, Object?> map) {
    return CommunityDto(
      id: id,
      name: map['name']! as String,
      description: map['description']! as String,
      type: map['type']! as String,
      ownerId: map['ownerId']! as String,
      coverImageUrl: map['coverImageUrl'] as String?,
      memberCount: map['memberCount']! as int,
      createdAt: DateTime.parse(map['createdAt']! as String),
      updatedAt: DateTime.parse(map['updatedAt']! as String),
    );
  }

  final String id;
  final String name;
  final String description;
  final String type;
  final String ownerId;
  final String? coverImageUrl;
  final int memberCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  Community toDomain() {
    return Community(
      id: id,
      name: name,
      description: description,
      type: CommunityType.values.byName(type),
      ownerId: ownerId,
      coverImageUrl: coverImageUrl,
      memberCount: memberCount,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'name': name,
      'description': description,
      'type': type,
      'ownerId': ownerId,
      'coverImageUrl': coverImageUrl,
      'memberCount': memberCount,
      'createdAt': createdAt.toUtc().toIso8601String(),
      'updatedAt': updatedAt.toUtc().toIso8601String(),
    };
  }
}
