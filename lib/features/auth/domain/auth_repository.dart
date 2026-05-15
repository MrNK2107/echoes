import 'package:echoes/features/auth/domain/auth_session.dart';

abstract interface class AuthRepository {
  Stream<AuthSession?> watchSession();

  Future<AuthSession> signInWithEmail({
    required String email,
    required String password,
  });

  Future<AuthSession> registerWithEmail({
    required String email,
    required String password,
    required String displayName,
  });

  Future<void> signOut();
}
