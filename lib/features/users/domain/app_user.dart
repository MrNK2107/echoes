import 'package:echoes/features/privacy/domain/privacy_type.dart';

class AppUser {
  const AppUser({
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

  final String id;
  final String? displayName;
  final String? email;
  final String? photoUrl;
  final PrivacyType defaultPrivacy;
  final List<String> managedPlaceIds;
  final List<String> communityIds;
  final DateTime createdAt;
  final DateTime updatedAt;
}
