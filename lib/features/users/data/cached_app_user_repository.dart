import 'package:echoes/core/cache/app_cache_registry.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:echoes/features/users/domain/app_user.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';

class CachedAppUserRepository implements AppUserRepository, AppCacheClient {
  CachedAppUserRepository(this._delegate, {AppCacheRegistry? cacheRegistry}) {
    cacheRegistry?.register(this);
  }

  final AppUserRepository _delegate;
  final Map<String, AppUser> _usersById = {};
  String? _currentUserId;

  @override
  String get cacheLabel => 'Profile settings';

  @override
  int get cachedItemCount => _usersById.length;

  @override
  void clearCache() {
    _usersById.clear();
  }

  @override
  Future<void> create(AppUser user) async {
    await _delegate.create(user);
    _rememberUser(user);
  }

  @override
  Future<AppUser?> findById(String id) async {
    final cached = _usersById[id];
    if (cached != null) {
      return cached;
    }

    final user = await _delegate.findById(id);
    if (user != null) {
      _rememberUser(user);
    }
    return user;
  }

  @override
  Future<List<AppUser>> searchUsers(String query, {int limit = 10}) async {
    final users = await _delegate.searchUsers(query, limit: limit);
    for (final user in users) {
      _rememberUser(user);
    }
    return users;
  }

  @override
  Future<void> setCurrentUserId(String? userId) async {
    await _delegate.setCurrentUserId(userId);
    _currentUserId = userId;
  }

  @override
  Future<void> updateDefaultPrivacy(PrivacyType privacy) async {
    await _delegate.updateDefaultPrivacy(privacy);
    final userId = _currentUserId;
    final cached = userId == null ? null : _usersById[userId];
    if (cached == null) {
      return;
    }

    _rememberUser(
      AppUser(
        id: cached.id,
        displayName: cached.displayName,
        email: cached.email,
        photoUrl: cached.photoUrl,
        defaultPrivacy: privacy,
        managedPlaceIds: cached.managedPlaceIds,
        communityIds: cached.communityIds,
        createdAt: cached.createdAt,
        updatedAt: DateTime.now().toUtc(),
      ),
    );
  }

  @override
  Stream<AppUser?> watchCurrentUser() async* {
    final currentUserId = _currentUserId;
    if (currentUserId != null && _usersById.containsKey(currentUserId)) {
      yield _usersById[currentUserId];
    }

    await for (final user in _delegate.watchCurrentUser()) {
      if (user != null) {
        _currentUserId = user.id;
        _rememberUser(user);
      }
      yield user;
    }
  }

  void _rememberUser(AppUser user) {
    _usersById[user.id] = user;
  }
}
