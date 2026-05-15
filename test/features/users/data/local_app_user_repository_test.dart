import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:echoes/features/users/data/local_app_user_repository.dart';
import 'package:echoes/features/users/domain/app_user.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LocalAppUserRepository', () {
    test('emits the selected current user profile', () async {
      final repository = LocalAppUserRepository();
      final user = _user(id: 'user-1');

      await repository.create(user);
      await repository.setCurrentUserId(user.id);

      final current = await repository.watchCurrentUser().first;

      expect(current?.id, user.id);
      expect(current?.defaultPrivacy, PrivacyType.public);
      repository.dispose();
    });

    test('updates default privacy for the current user only', () async {
      final repository = LocalAppUserRepository();

      await repository.create(_user(id: 'user-1'));
      await repository.create(_user(id: 'user-2'));
      await repository.setCurrentUserId('user-1');
      await repository.updateDefaultPrivacy(PrivacyType.private);

      final userOne = await repository.findById('user-1');
      final userTwo = await repository.findById('user-2');

      expect(userOne?.defaultPrivacy, PrivacyType.private);
      expect(userTwo?.defaultPrivacy, PrivacyType.public);
      repository.dispose();
    });
  });
}

AppUser _user({required String id}) {
  final now = DateTime.utc(2026, 5, 15);
  return AppUser(
    id: id,
    displayName: 'Nanda',
    email: '$id@example.com',
    defaultPrivacy: PrivacyType.public,
    managedPlaceIds: const [],
    communityIds: const [],
    createdAt: now,
    updatedAt: now,
  );
}
