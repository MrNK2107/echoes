import 'package:echoes/features/auth/presentation/auth_validators.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AuthValidators', () {
    test('requires valid email address', () {
      expect(AuthValidators.email(''), 'Email is required');
      expect(AuthValidators.email('nanda'), 'Enter a valid email');
      expect(AuthValidators.email('nanda@example.com'), isNull);
    });

    test('requires password with at least 8 characters', () {
      expect(AuthValidators.password(''), 'Password is required');
      expect(AuthValidators.password('short'), 'Use at least 8 characters');
      expect(AuthValidators.password('password123'), isNull);
    });

    test('requires display name', () {
      expect(AuthValidators.displayName(''), 'Name is required');
      expect(AuthValidators.displayName('Nanda'), isNull);
    });
  });
}
