import 'package:echoes/features/auth/domain/auth_repository.dart';
import 'package:echoes/features/auth/domain/auth_session.dart';
import 'package:firebase_auth/firebase_auth.dart';

class FirebaseAuthRepository implements AuthRepository {
  FirebaseAuthRepository({FirebaseAuth? firebaseAuth})
    : _firebaseAuth = firebaseAuth ?? FirebaseAuth.instance;

  final FirebaseAuth _firebaseAuth;

  @override
  Stream<AuthSession?> watchSession() {
    return _firebaseAuth.authStateChanges().map(_toSession);
  }

  @override
  Future<AuthSession> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _firebaseAuth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      return _requiredSession(credential.user);
    } on FirebaseAuthException catch (error) {
      throw Exception(error.message ?? error.code);
    }
  }

  @override
  Future<AuthSession> registerWithEmail({
    required String email,
    required String password,
    required String displayName,
  }) async {
    try {
      final credential = await _firebaseAuth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );
      final user = credential.user;
      if (user == null) {
        throw Exception('Account creation failed.');
      }

      await user.updateDisplayName(displayName);
      await user.reload();
      return _requiredSession(_firebaseAuth.currentUser);
    } on FirebaseAuthException catch (error) {
      throw Exception(error.message ?? error.code);
    }
  }

  @override
  Future<void> signOut() {
    return _firebaseAuth.signOut();
  }

  AuthSession? _toSession(User? user) {
    if (user == null || user.email == null) {
      return null;
    }

    return AuthSession(
      userId: user.uid,
      email: user.email!,
      displayName: user.displayName,
    );
  }

  AuthSession _requiredSession(User? user) {
    final session = _toSession(user);
    if (session == null) {
      throw Exception('No authenticated Firebase user found.');
    }
    return session;
  }
}