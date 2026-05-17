import 'dart:async';

import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/data/cached_memory_repository.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CachedMemoryRepository', () {
    test('replays cached user memories before fresh stream values', () async {
      final delegate = _FakeMemoryRepository();
      final repository = CachedMemoryRepository(delegate);
      final now = DateTime.utc(2026, 5, 17);
      final cached = _memory(id: 'cached', createdAt: now);
      final fresh = _memory(id: 'fresh', createdAt: now);

      final first = repository.watchMemoriesForUser('user-1');
      final firstExpectation = expectLater(
        first,
        emits(_memoryIds(const ['cached'])),
      );
      await Future<void>.delayed(Duration.zero);
      delegate.emitUser('user-1', [cached]);
      await firstExpectation;

      final second = repository.watchMemoriesForUser('user-1');

      final freshExpectation = expectLater(
        second,
        emitsInOrder([
          _memoryIds(const ['cached']),
          _memoryIds(const ['fresh']),
        ]),
      );
      await Future<void>.delayed(Duration.zero);
      delegate.emitUser('user-1', [fresh]);
      await freshExpectation;
      await delegate.dispose();
    });

    test('softDelete updates cached memory visibility', () async {
      final delegate = _FakeMemoryRepository();
      final repository = CachedMemoryRepository(delegate);
      final memory = _memory(
        id: 'memory-1',
        createdAt: DateTime.utc(2026, 5, 17),
      );

      await repository.create(memory);
      await repository.softDelete(
        memoryId: memory.id,
        deletedAt: DateTime.utc(2026, 5, 18),
      );

      final deleted = await repository.findById(memory.id);
      expect(deleted?.isDeleted, isTrue);
      await delegate.dispose();
    });
  });
}

class _FakeMemoryRepository implements MemoryRepository {
  final _userControllers = <String, StreamController<List<Memory>>>{};
  final _placeControllers = <String, StreamController<List<Memory>>>{};
  final Map<String, Memory> saved = {};

  void emitUser(String userId, List<Memory> memories) {
    _userControllers.putIfAbsent(userId, _newController).add(memories);
  }

  Future<void> dispose() async {
    for (final controller in [
      ..._userControllers.values,
      ..._placeControllers.values,
    ]) {
      await controller.close();
    }
  }

  @override
  Future<void> create(Memory memory) async {
    saved[memory.id] = memory;
  }

  @override
  Future<Memory?> findById(String id) async {
    return saved[id];
  }

  @override
  Future<void> softDelete({
    required String memoryId,
    required DateTime deletedAt,
  }) async {
    final memory = saved[memoryId];
    if (memory == null) {
      return;
    }
    saved[memoryId] = memory.copyWith(
      isDeleted: true,
      deletedAt: deletedAt,
      updatedAt: deletedAt,
    );
  }

  @override
  Future<void> updateImageUrl({
    required String memoryId,
    required String imageUrl,
    required DateTime updatedAt,
  }) async {}

  @override
  Future<void> updateTextAndPrivacy({
    required String memoryId,
    required String textContent,
    required PrivacyType privacy,
    required List<String> taggedUserIds,
    required DateTime? releaseDate,
    required String? communityId,
  }) async {}

  @override
  Stream<List<Memory>> watchMemoriesForPlace(String placeId) {
    return _placeControllers.putIfAbsent(placeId, _newController).stream;
  }

  @override
  Stream<List<Memory>> watchMemoriesForUser(String userId) {
    return _userControllers.putIfAbsent(userId, _newController).stream;
  }

  @override
  Stream<List<Memory>> watchVisibleMemoriesForPlace({
    required String placeId,
    required String viewerId,
    required Set<String> viewerCommunityIds,
    required DateTime now,
  }) {
    return watchMemoriesForPlace(placeId);
  }

  StreamController<List<Memory>> _newController() {
    return StreamController<List<Memory>>.broadcast();
  }
}

Memory _memory({required String id, required DateTime createdAt}) {
  return Memory(
    id: id,
    userId: 'user-1',
    placeId: 'place-1',
    textContent: 'Cached memory',
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

Matcher _memoryIds(List<String> ids) {
  return predicate<List<Memory>>((memories) {
    final actualIds = memories.map((memory) => memory.id).toList();
    return _sameIds(actualIds, ids);
  }, 'memories with ids $ids');
}

bool _sameIds(List<String> actual, List<String> expected) {
  if (actual.length != expected.length) {
    return false;
  }
  for (var index = 0; index < actual.length; index++) {
    if (actual[index] != expected[index]) {
      return false;
    }
  }
  return true;
}
