import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:echoes/features/users/domain/app_user.dart';

class AppUserDto {
  const AppUserDto({
    required this.id,
    required this.defaultPrivacy,
    required this.managedPlaceIds,
    required this.communityIds,
    required this.createdAt,
    required this.updatedAt,
    this.displayName,
    this.email,
    this.photoUrl,
  });

  factory AppUserDto.fromDomain(AppUser user) {
    return AppUserDto(
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      photoUrl: user.photoUrl,
      defaultPrivacy: user.defaultPrivacy.name,
      managedPlaceIds: user.managedPlaceIds,
      communityIds: user.communityIds,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    );
  }

  factory AppUserDto.fromMap(String id, Map<String, Object?> map) {
    return AppUserDto(
      id: id,
      displayName: map['displayName'] as String?,
      email: map['email'] as String?,
      photoUrl: map['photoUrl'] as String?,
      defaultPrivacy: map['defaultPrivacy']! as String,
      managedPlaceIds: List<String>.from(map['managedPlaceIds']! as List),
      communityIds: List<String>.from(map['communityIds']! as List),
      createdAt: DateTime.parse(map['createdAt']! as String),
      updatedAt: DateTime.parse(map['updatedAt']! as String),
    );
  }

  final String id;
  final String? displayName;
  final String? email;
  final String? photoUrl;
  final String defaultPrivacy;
  final List<String> managedPlaceIds;
  final List<String> communityIds;
  final DateTime createdAt;
  final DateTime updatedAt;

  AppUser toDomain() {
    return AppUser(
      id: id,
      displayName: displayName,
      email: email,
      photoUrl: photoUrl,
      defaultPrivacy: PrivacyType.values.byName(defaultPrivacy),
      managedPlaceIds: managedPlaceIds,
      communityIds: communityIds,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'displayName': displayName,
      'email': email,
      'photoUrl': photoUrl,
      'defaultPrivacy': defaultPrivacy,
      'managedPlaceIds': managedPlaceIds,
      'communityIds': communityIds,
      'createdAt': createdAt.toUtc().toIso8601String(),
      'updatedAt': updatedAt.toUtc().toIso8601String(),
    };
  }
}
