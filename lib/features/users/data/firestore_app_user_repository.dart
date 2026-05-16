import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:echoes/features/users/data/app_user_dto.dart';
import 'package:echoes/features/users/domain/app_user.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';

class FirestoreAppUserRepository implements AppUserRepository {
  FirestoreAppUserRepository({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;
  final StreamController<AppUser?> _controller =
      StreamController<AppUser?>.broadcast();
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>?
  _currentUserSubscription;
  String? _currentUserId;

  CollectionReference<Map<String, dynamic>> get _collection =>
      _firestore.collection('users');

  @override
  Stream<AppUser?> watchCurrentUser() async* {
    if (_currentUserId == null) {
      yield null;
    } else {
      yield await findById(_currentUserId!);
    }
    yield* _controller.stream;
  }

  @override
  Future<AppUser?> findById(String id) async {
    final snapshot = await _collection.doc(id).get();
    final data = snapshot.data();
    if (data == null) {
      return null;
    }
    return AppUserDto.fromMap(snapshot.id, data).toDomain();
  }

  @override
  Future<List<AppUser>> searchUsers(String query, {int limit = 10}) async {
    final normalized = query.trim().toLowerCase();
    if (normalized.isEmpty) {
      return const [];
    }

    final snapshot = await _collection.limit(limit * 3).get();
    return snapshot.docs
        .map((doc) => AppUserDto.fromMap(doc.id, doc.data()).toDomain())
        .where((user) {
          return user.id.toLowerCase().contains(normalized) ||
              (user.email?.toLowerCase().contains(normalized) ?? false) ||
              (user.displayName?.toLowerCase().contains(normalized) ?? false);
        })
        .take(limit)
        .toList(growable: false);
  }

  @override
  Future<void> setCurrentUserId(String? userId) async {
    if (_currentUserId == userId) {
      return;
    }

    _currentUserId = userId;
    await _currentUserSubscription?.cancel();
    _currentUserSubscription = null;

    if (userId == null) {
      _controller.add(null);
      return;
    }

    _currentUserSubscription = _collection.doc(userId).snapshots().listen((
      snapshot,
    ) {
      final data = snapshot.data();
      _controller.add(
        data == null ? null : AppUserDto.fromMap(snapshot.id, data).toDomain(),
      );
    });
  }

  @override
  Future<void> create(AppUser user) {
    return _collection.doc(user.id).set(AppUserDto.fromDomain(user).toMap());
  }

  @override
  Future<void> updateDefaultPrivacy(PrivacyType privacy) async {
    final userId = _currentUserId;
    if (userId == null) {
      return;
    }

    await _collection.doc(userId).update({
      'defaultPrivacy': privacy.name,
      'updatedAt': DateTime.now().toUtc().toIso8601String(),
    });
  }

  Future<void> dispose() async {
    await _currentUserSubscription?.cancel();
    await _controller.close();
  }
}
