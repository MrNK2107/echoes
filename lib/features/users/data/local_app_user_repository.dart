import 'dart:async';

import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:echoes/features/users/domain/app_user.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';

class LocalAppUserRepository implements AppUserRepository {
  final Map<String, AppUser> _users = {};
  final _controller = StreamController<AppUser?>.broadcast();
  String? _currentUserId;

  @override
  Stream<AppUser?> watchCurrentUser() async* {
    yield _currentUser;
    yield* _controller.stream;
  }

  @override
  Future<AppUser?> findById(String id) async {
    return _users[id];
  }

  @override
  Future<void> setCurrentUserId(String? userId) async {
    _currentUserId = userId;
    _controller.add(_currentUser);
  }

  @override
  Future<void> create(AppUser user) async {
    _users[user.id] = user;
    if (_currentUserId == user.id) {
      _controller.add(user);
    }
  }

  @override
  Future<void> updateDefaultPrivacy(PrivacyType privacy) async {
    final user = _currentUser;
    if (user == null) {
      return;
    }

    final updated = AppUser(
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
    _users[updated.id] = updated;
    _controller.add(updated);
  }

  AppUser? get _currentUser {
    final id = _currentUserId;
    return id == null ? null : _users[id];
  }

  void dispose() {
    _controller.close();
  }
}
