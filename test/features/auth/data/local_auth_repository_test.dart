import 'package:echoes/features/auth/data/local_auth_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LocalAuthRepository', () {
    test('starts with no active session', () async {
      final repository = LocalAuthRepository();

      expect(await repository.watchSession().first, isNull);

      repository.dispose();
    });

    test('signInWithEmail returns and emits a session', () async {
      final repository = LocalAuthRepository();
      final sessions = <String?>[];
      final subscription = repository.watchSession().listen(
        (session) => sessions.add(session?.email),
      );
      await Future<void>.delayed(Duration.zero);

      final session = await repository.signInWithEmail(
        email: 'nanda@example.com',
        password: 'password123',
      );
      await Future<void>.delayed(Duration.zero);

      expect(session.userId, 'nanda@example.com');
      expect(session.email, 'nanda@example.com');
      expect(sessions, [null, 'nanda@example.com']);

      await subscription.cancel();
      repository.dispose();
    });

    test('registerWithEmail preserves display name', () async {
      final repository = LocalAuthRepository();

      final session = await repository.registerWithEmail(
        email: 'nanda@example.com',
        password: 'password123',
        displayName: 'Nanda',
      );

      expect(session.displayName, 'Nanda');

      repository.dispose();
    });

    test('signOut clears the active session', () async {
      final repository = LocalAuthRepository();
      final sessions = <String?>[];
      final subscription = repository.watchSession().listen(
        (session) => sessions.add(session?.email),
      );
      await Future<void>.delayed(Duration.zero);

      await repository.signInWithEmail(
        email: 'nanda@example.com',
        password: 'password123',
      );
      await repository.signOut();
      await Future<void>.delayed(Duration.zero);

      expect(sessions, [null, 'nanda@example.com', null]);

      await subscription.cancel();
      repository.dispose();
    });
  });
}
