import 'package:echoes/features/memories/presentation/memory_validators.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('MemoryValidators', () {
    test('requires memory text', () {
      expect(MemoryValidators.text(''), 'Memory text is required');
      expect(MemoryValidators.text('A small memory'), isNull);
    });

    test('caps memory text at 2000 characters', () {
      expect(
        MemoryValidators.text('a' * 2001),
        'Keep memories under 2000 characters',
      );
    });
  });
}
