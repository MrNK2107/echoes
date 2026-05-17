import 'dart:async';

import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:echoes/features/users/data/cached_app_user_repository.dart';
import 'package:echoes/features/users/domain/app_user.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CachedAppUserRepository', () {
    test(
      'findById returns remembered profiles without delegate lookup',
      () async {
        final delegate = _FakeAppUserRepository();
        final repository = CachedAppUserRepository(delegate);
        final user = _user(id: 'user-1');

        await repository.create(user);

        expect(await repository.findById(user.id), user);
        expect(delegate.findByIdCalls, isZero);
        await delegate.dispose();
      },
    );

    test(
      'watchCurrentUser replays cached profile before fresh values',
      () async {
        final delegate = _FakeAppUserRepository();
        final repository = CachedAppUserRepository(delegate);
        final cached = _user(id: 'user-1', defaultPrivacy: PrivacyType.private);
        final fresh = _user(id: 'user-1', defaultPrivacy: PrivacyType.tagged);

        await repository.create(cached);
        await repository.setCurrentUserId(cached.id);

        final stream = repository.watchCurrentUser();
        final expectation = expectLater(
          stream,
          emitsInOrder([
            _profilePrivacy(PrivacyType.private),
            _profilePrivacy(PrivacyType.tagged),
          ]),
        );
        await Future<void>.delayed(Duration.zero);
        delegate.emit(fresh);

        await expectation;
        await delegate.dispose();
      },
    );

    test('updateDefaultPrivacy updates cached settings snapshot', () async {
      final delegate = _FakeAppUserRepository();
      final repository = CachedAppUserRepository(delegate);

      await repository.create(_user(id: 'user-1'));
      await repository.setCurrentUserId('user-1');
      await repository.updateDefaultPrivacy(PrivacyType.community);

      final cached = await repository.findById('user-1');

      expect(cached?.defaultPrivacy, PrivacyType.community);
      await delegate.dispose();
    });
  });
}

class _FakeAppUserRepository implements AppUserRepository {
  final Map<String, AppUser> users = {};
  final _controller = StreamController<AppUser?>.broadcast();
  String? currentUserId;
  int findByIdCalls = 0;

  void emit(AppUser? user) {
    _controller.add(user);
  }

  Future<void> dispose() => _controller.close();

  @override
  Future<void> create(AppUser user) async {
    users[user.id] = user;
  }

  @override
  Future<AppUser?> findById(String id) async {
    findByIdCalls++;
    return users[id];
  }

  @override
  Future<List<AppUser>> searchUsers(String query, {int limit = 10}) async {
    return users.values.take(limit).toList(growable: false);
  }

  @override
  Future<void> setCurrentUserId(String? userId) async {
    currentUserId = userId;
  }

  @override
  Future<void> updateDefaultPrivacy(PrivacyType privacy) async {
    final userId = currentUserId;
    final user = userId == null ? null : users[userId];
    if (user == null) {
      return;
    }

    users[user.id] = AppUser(
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      photoUrl: user.photoUrl,
      defaultPrivacy: privacy,
      managedPlaceIds: user.managedPlaceIds,
      communityIds: user.communityIds,
      createdAt: user.createdAt,
      updatedAt: DateTime.now().toUtc(),
    );
  }

  @override
  Stream<AppUser?> watchCurrentUser() {
    return _controller.stream;
  }
}

AppUser _user({
  required String id,
  PrivacyType defaultPrivacy = PrivacyType.public,
}) {
  final now = DateTime.utc(2026, 5, 17);
  return AppUser(
    id: id,
    displayName: 'Nanda',
    email: '$id@example.com',
    defaultPrivacy: defaultPrivacy,
    managedPlaceIds: const [],
    communityIds: const [],
    createdAt: now,
    updatedAt: now,
  );
}

Matcher _profilePrivacy(PrivacyType privacy) {
  return predicate<AppUser?>(
    (user) => user?.defaultPrivacy == privacy,
    'profile with default privacy ${privacy.name}',
  );
}
