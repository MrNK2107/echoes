import 'package:echoes/features/memories/data/firestore_memory_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('FirestoreMemoryRepository bounds list streams by default', () {
    expect(FirestoreMemoryRepository.defaultPlaceMemoryLimit, 50);
    expect(FirestoreMemoryRepository.defaultUserMemoryLimit, 50);
  });

  test('FirestoreMemoryRepository caps community visibility query ids', () {
    expect(FirestoreMemoryRepository.maxCommunityQueryIds, 10);
  });

  test(
    'FirestoreMemoryRepository uses multiple server-side visibility paths',
    () {
      expect(FirestoreMemoryRepository.visibleMemoryQueryPathCount, 5);
    },
  );
}
