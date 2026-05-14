import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:echoes/features/users/domain/app_user.dart';

abstract interface class AppUserRepository {
  Stream<AppUser?> watchCurrentUser();

  Future<AppUser?> findById(String id);

  Future<void> create(AppUser user);

  Future<void> updateDefaultPrivacy(PrivacyType privacy);
}
