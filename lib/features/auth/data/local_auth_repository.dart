import 'dart:async';

import 'package:echoes/features/auth/domain/auth_repository.dart';
import 'package:echoes/features/auth/domain/auth_session.dart';

class LocalAuthRepository implements AuthRepository {
  final _controller = StreamController<AuthSession?>.broadcast();
  AuthSession? _session;

  @override
  Stream<AuthSession?> watchSession() async* {
    yield _session;
    yield* _controller.stream;
  }

  @override
  Future<void> signInWithEmail({
    required String email,
    required String password,
  }) async {
    _session = AuthSession(userId: email, email: email);
    _controller.add(_session);
  }

  @override
  Future<void> registerWithEmail({
    required String email,
    required String password,
    required String displayName,
  }) async {
    _session = AuthSession(
      userId: email,
      email: email,
      displayName: displayName,
    );
    _controller.add(_session);
  }

  @override
  Future<void> signOut() async {
    _session = null;
    _controller.add(null);
  }

  void dispose() {
    _controller.close();
  }
}
