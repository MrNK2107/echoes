import 'dart:async';

import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';

class LocalMemoryRepository implements MemoryRepository {
  final List<Memory> _memories = [];
  final _controller = StreamController<List<Memory>>.broadcast();

  @override
  Future<void> create(Memory memory) async {
    _memories.add(memory);
    _controller.add(List.unmodifiable(_memories));
  }

  @override
  Future<Memory?> findById(String id) async {
    return _memories.where((memory) => memory.id == id).firstOrNull;
  }

  @override
  Future<void> softDelete({
    required String memoryId,
    required DateTime deletedAt,
  }) async {
    final index = _memories.indexWhere((memory) => memory.id == memoryId);
    if (index == -1) {
      return;
    }
    final current = _memories[index];
    _memories[index] = Memory(
      id: current.id,
      userId: current.userId,
      placeId: current.placeId,
      imageUrl: current.imageUrl,
      audioUrl: current.audioUrl,
      textContent: current.textContent,
      latitude: current.latitude,
      longitude: current.longitude,
      geohash: current.geohash,
      sentiment: current.sentiment,
      privacy: current.privacy,
      taggedUserIds: current.taggedUserIds,
      communityId: current.communityId,
      releaseDate: current.releaseDate,
      isDeleted: true,
      deletedAt: deletedAt,
      createdAt: current.createdAt,
      updatedAt: deletedAt,
    );
    _controller.add(List.unmodifiable(_memories));
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
    final index = _memories.indexWhere((memory) => memory.id == memoryId);
    if (index == -1) {
      return;
    }
    final current = _memories[index];
    _memories[index] = Memory(
      id: current.id,
      userId: current.userId,
      placeId: current.placeId,
      imageUrl: current.imageUrl,
      audioUrl: current.audioUrl,
      textContent: textContent,
      latitude: current.latitude,
      longitude: current.longitude,
      geohash: current.geohash,
      sentiment: current.sentiment,
      privacy: privacy,
      taggedUserIds: taggedUserIds,
      communityId: communityId,
      releaseDate: releaseDate,
      isDeleted: current.isDeleted,
      deletedAt: current.deletedAt,
      createdAt: current.createdAt,
      updatedAt: DateTime.now().toUtc(),
    );
    _controller.add(List.unmodifiable(_memories));
  }

  @override
  Stream<List<Memory>> watchMemoriesForPlace(String placeId) async* {
    yield _visibleMemoriesForPlace(placeId);
    yield* _controller.stream.map((_) => _visibleMemoriesForPlace(placeId));
  }

  @override
  Stream<List<Memory>> watchVisibleMemoriesForPlace({
    required String placeId,
    required String viewerId,
    required Set<String> viewerCommunityIds,
    required DateTime now,
  }) async* {
    yield _visibleMemoriesForPlaceAndViewer(
      placeId: placeId,
      viewerId: viewerId,
      viewerCommunityIds: viewerCommunityIds,
      now: now,
    );
    yield* _controller.stream.map(
      (_) => _visibleMemoriesForPlaceAndViewer(
        placeId: placeId,
        viewerId: viewerId,
        viewerCommunityIds: viewerCommunityIds,
        now: now,
      ),
    );
  }

  @override
  Stream<List<Memory>> watchMemoriesForUser(String userId) async* {
    yield _visibleMemoriesForUser(userId);
    yield* _controller.stream.map((_) => _visibleMemoriesForUser(userId));
  }

  List<Memory> _visibleMemoriesForPlace(String placeId) {
    return _memories
        .where((memory) => memory.placeId == placeId && !memory.isDeleted)
        .toList();
  }

  List<Memory> _visibleMemoriesForPlaceAndViewer({
    required String placeId,
    required String viewerId,
    required Set<String> viewerCommunityIds,
    required DateTime now,
  }) {
    return _memories.where((memory) {
      final communityId = memory.communityId;
      return memory.placeId == placeId &&
          memory.isVisibleTo(
            viewerId: viewerId,
            viewerIsCommunityMember:
                communityId != null && viewerCommunityIds.contains(communityId),
            now: now,
          );
    }).toList();
  }

  List<Memory> _visibleMemoriesForUser(String userId) {
    return _memories
        .where((memory) => memory.userId == userId && !memory.isDeleted)
        .toList();
  }

  void dispose() {
    _controller.close();
  }
}
