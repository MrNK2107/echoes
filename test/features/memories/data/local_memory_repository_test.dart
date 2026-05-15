import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/data/local_memory_repository.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LocalMemoryRepository', () {
    test('creates and reads memories by id, user, and place', () async {
      final repository = LocalMemoryRepository();
      final memory = _memory(createdAt: DateTime.utc(2026, 5, 14));

      await repository.create(memory);

      final found = await repository.findById(memory.id);
      final userMemories = await repository
          .watchMemoriesForUser(memory.userId)
          .first;
      final placeMemories = await repository
          .watchMemoriesForPlace(memory.placeId)
          .first;

      expect(found?.id, memory.id);
      expect(userMemories.map((memory) => memory.id), [memory.id]);
      expect(placeMemories.map((memory) => memory.id), [memory.id]);
      repository.dispose();
    });

    test(
      'updates text and privacy without changing location or timestamp',
      () async {
        final repository = LocalMemoryRepository();
        final createdAt = DateTime.utc(2026, 5, 14);
        final memory = _memory(createdAt: createdAt);

        await repository.create(memory);
        await repository.updateTextAndPrivacy(
          memoryId: memory.id,
          textContent: 'Updated memory',
          privacy: PrivacyType.private,
          taggedUserIds: const [],
          releaseDate: null,
          communityId: null,
        );

        final updated = await repository.findById(memory.id);

        expect(updated?.textContent, 'Updated memory');
        expect(updated?.privacy, PrivacyType.private);
        expect(updated?.latitude, memory.latitude);
        expect(updated?.longitude, memory.longitude);
        expect(updated?.createdAt, createdAt);
        repository.dispose();
      },
    );

    test('soft deleted memories are hidden from normal streams', () async {
      final repository = LocalMemoryRepository();
      final memory = _memory(createdAt: DateTime.utc(2026, 5, 14));

      await repository.create(memory);
      await repository.softDelete(
        memoryId: memory.id,
        deletedAt: DateTime.utc(2026, 5, 15),
      );

      final visible = await repository
          .watchMemoriesForUser(memory.userId)
          .first;
      final deleted = await repository.findById(memory.id);

      expect(visible, isEmpty);
      expect(deleted?.isDeleted, isTrue);
      repository.dispose();
    });
  });
}

Memory _memory({required DateTime createdAt}) {
  return Memory(
    id: 'memory-1',
    userId: 'user-1',
    placeId: 'place-1',
    textContent: 'Original memory',
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: 'tdr1v',
    sentiment: const SentimentResult(
      compound: 0,
      positive: 0,
      neutral: 1,
      negative: 0,
    ),
    privacy: PrivacyType.public,
    taggedUserIds: const [],
    isDeleted: false,
    createdAt: createdAt,
    updatedAt: createdAt,
  );
}
