import 'package:echoes/features/memories/data/firestore_memory_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('FirestoreMemoryRepository bounds list streams by default', () {
    expect(FirestoreMemoryRepository.defaultPlaceMemoryLimit, 50);
    expect(FirestoreMemoryRepository.defaultUserMemoryLimit, 50);
  });
}
