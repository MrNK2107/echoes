import 'package:echoes/core/media/local_image_cache.dart';
import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/memory_detail_sheet.dart';
import 'package:echoes/features/memories/presentation/memory_image_preview.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'MemoryDetailSheet renders memory details and restore for deleted memories',
    (tester) async {
      await tester.pumpWidget(
        MultiRepositoryProvider(
          providers: [
            RepositoryProvider<LocalImageCache>(
              create: (_) => LocalImageCache(),
            ),
            RepositoryProvider<MemoryRepository>(
              create: (_) => _FakeMemoryRepository(),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: MemoryDetailSheet(
                memory: _memory(isDeleted: true),
                onEdit: () {},
                onDelete: () {},
              ),
            ),
          ),
        ),
      );

      expect(find.text('Public'), findsOneWidget);
      expect(find.textContaining('Created 14/05/2026'), findsOneWidget);
      expect(find.text('Created by user-1'), findsOneWidget);
      expect(find.text('A memory from the old courtyard.'), findsOneWidget);
      expect(find.byType(MemoryImagePreview), findsOneWidget);
      expect(find.byKey(const ValueKey('editMemoryButton')), findsOneWidget);
      expect(find.byKey(const ValueKey('deleteMemoryButton')), findsOneWidget);
      expect(
        find.byKey(const ValueKey('restoreMemoryButton')),
        findsOneWidget,
      );
    },
  );

  testWidgets('MemoryDetailSheet hides creator for private memories', (
    tester,
  ) async {
    await tester.pumpWidget(
      RepositoryProvider(
        create: (_) => LocalImageCache(),
        child: MaterialApp(
          home: Scaffold(
            body: MemoryDetailSheet(
              memory: _memory(privacy: PrivacyType.private),
            ),
          ),
        ),
      ),
    );

    expect(find.textContaining('Created by'), findsNothing);
  });
}

Memory _memory({PrivacyType privacy = PrivacyType.public, bool isDeleted = false}) {
  return Memory(
    id: 'memory-1',
    userId: 'user-1',
    placeId: 'place-1',
    imageUrl: 'https://example.com/memory.jpg',
    textContent: 'A memory from the old courtyard.',
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: 'tdr1v',
    sentiment: const SentimentResult(
      compound: 0.2,
      positive: 0.3,
      neutral: 0.7,
      negative: 0,
    ),
    privacy: privacy,
    taggedUserIds: const [],
    isDeleted: isDeleted,
    createdAt: DateTime.utc(2026, 5, 14),
    updatedAt: DateTime.utc(2026, 5, 14),
  );
}

class _FakeMemoryRepository implements MemoryRepository {
  @override
  Future<void> create(Memory memory) async {}

  @override
  Future<Memory?> findById(String id) async => null;

  @override
  Future<void> restore({
    required String memoryId,
    required DateTime restoredAt,
  }) async {}

  @override
  Future<void> softDelete({
    required String memoryId,
    required DateTime deletedAt,
  }) async {}

  @override
  Future<void> updateImageUrl({
    required String memoryId,
    required String imageUrl,
    required DateTime updatedAt,
  }) async {}

  @override
  Stream<List<Memory>> watchCommunityMemories(
    String communityId, {
    int limit = 50,
  }) {
    return Stream.value([]);
  }

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
    return Stream.value([]);
  }

  @override
  Stream<List<Memory>> watchMemoriesForUser(String userId) {
    return Stream.value([]);
  }

  @override
  Stream<List<Memory>> watchVisibleMemoriesForPlace({
    required String placeId,
    required String viewerId,
    required Set<String> viewerCommunityIds,
    required DateTime now,
  }) {
    return Stream.value([]);
  }
}
