import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';

class CachedMemoryRepository implements MemoryRepository {
  CachedMemoryRepository(this._delegate);

  final MemoryRepository _delegate;
  final Map<String, Memory> _memoriesById = {};
  final Map<String, List<Memory>> _memoriesByPlace = {};
  final Map<String, List<Memory>> _memoriesByUser = {};

  @override
  Future<void> create(Memory memory) async {
    await _delegate.create(memory);
    _rememberMemory(memory);
  }

  @override
  Future<Memory?> findById(String id) async {
    final cached = _memoriesById[id];
    if (cached != null) {
      return cached;
    }

    final memory = await _delegate.findById(id);
    if (memory != null) {
      _rememberMemory(memory);
    }
    return memory;
  }

  @override
  Future<void> softDelete({
    required String memoryId,
    required DateTime deletedAt,
  }) async {
    await _delegate.softDelete(memoryId: memoryId, deletedAt: deletedAt);
    final cached = _memoriesById[memoryId];
    if (cached != null) {
      _rememberMemory(
        cached.copyWith(
          isDeleted: true,
          deletedAt: deletedAt,
          updatedAt: deletedAt,
        ),
      );
    }
  }

  @override
  Future<void> updateImageUrl({
    required String memoryId,
    required String imageUrl,
    required DateTime updatedAt,
  }) async {
    await _delegate.updateImageUrl(
      memoryId: memoryId,
      imageUrl: imageUrl,
      updatedAt: updatedAt,
    );
    final cached = _memoriesById[memoryId];
    if (cached != null) {
      _rememberMemory(
        cached.copyWith(imageUrl: imageUrl, updatedAt: updatedAt),
      );
    }
  }

  @override
  Future<void> updateTextAndPrivacy({
    required String memoryId,
    required String textContent,
    required PrivacyType privacy,
    required List<String> taggedUserIds,
    required DateTime? releaseDate,
    required String? communityId,
  }) async {
    await _delegate.updateTextAndPrivacy(
      memoryId: memoryId,
      textContent: textContent,
      privacy: privacy,
      taggedUserIds: taggedUserIds,
      releaseDate: releaseDate,
      communityId: communityId,
    );
    final cached = _memoriesById[memoryId];
    if (cached != null) {
      _rememberMemory(
        cached.copyWith(
          textContent: textContent,
          privacy: privacy,
          taggedUserIds: taggedUserIds,
          releaseDate: releaseDate,
          communityId: communityId,
          updatedAt: DateTime.now().toUtc(),
        ),
      );
    }
  }

  @override
  Stream<List<Memory>> watchMemoriesForPlace(String placeId) async* {
    final cached = _memoriesByPlace[placeId];
    if (cached != null) {
      yield cached;
    }

    await for (final memories in _delegate.watchMemoriesForPlace(placeId)) {
      final snapshot = List<Memory>.unmodifiable(memories);
      _rememberPlaceMemories(placeId, snapshot);
      yield snapshot;
    }
  }

  @override
  Stream<List<Memory>> watchMemoriesForUser(String userId) async* {
    final cached = _memoriesByUser[userId];
    if (cached != null) {
      yield cached;
    }

    await for (final memories in _delegate.watchMemoriesForUser(userId)) {
      final snapshot = List<Memory>.unmodifiable(memories);
      _rememberUserMemories(userId, snapshot);
      yield snapshot;
    }
  }

  @override
  Stream<List<Memory>> watchVisibleMemoriesForPlace({
    required String placeId,
    required String viewerId,
    required Set<String> viewerCommunityIds,
    required DateTime now,
  }) async* {
    final cached = _memoriesByPlace[placeId];
    if (cached != null) {
      yield _visibleMemories(
        cached,
        viewerId: viewerId,
        viewerCommunityIds: viewerCommunityIds,
        now: now,
      );
    }

    await for (final memories in _delegate.watchVisibleMemoriesForPlace(
      placeId: placeId,
      viewerId: viewerId,
      viewerCommunityIds: viewerCommunityIds,
      now: now,
    )) {
      final snapshot = List<Memory>.unmodifiable(memories);
      _rememberPlaceMemories(placeId, snapshot);
      yield snapshot;
    }
  }

  void _rememberMemory(Memory memory) {
    _memoriesById[memory.id] = memory;
    _rememberInBucket(_memoriesByPlace, memory.placeId, memory);
    _rememberInBucket(_memoriesByUser, memory.userId, memory);
  }

  void _rememberPlaceMemories(String placeId, List<Memory> memories) {
    _memoriesByPlace[placeId] = memories;
    for (final memory in memories) {
      _memoriesById[memory.id] = memory;
      _rememberInBucket(_memoriesByUser, memory.userId, memory);
    }
  }

  void _rememberUserMemories(String userId, List<Memory> memories) {
    _memoriesByUser[userId] = memories;
    for (final memory in memories) {
      _memoriesById[memory.id] = memory;
      _rememberInBucket(_memoriesByPlace, memory.placeId, memory);
    }
  }

  void _rememberInBucket(
    Map<String, List<Memory>> cache,
    String key,
    Memory memory,
  ) {
    final existing = List<Memory>.of(cache[key] ?? const []);
    final index = existing.indexWhere((current) => current.id == memory.id);
    if (index == -1) {
      existing.add(memory);
    } else {
      existing[index] = memory;
    }
    cache[key] = List<Memory>.unmodifiable(existing);
  }

  List<Memory> _visibleMemories(
    List<Memory> memories, {
    required String viewerId,
    required Set<String> viewerCommunityIds,
    required DateTime now,
  }) {
    return memories
        .where((memory) {
          final communityId = memory.communityId;
          return memory.isVisibleTo(
            viewerId: viewerId,
            viewerIsCommunityMember:
                communityId != null && viewerCommunityIds.contains(communityId),
            now: now,
          );
        })
        .toList(growable: false);
  }
}
