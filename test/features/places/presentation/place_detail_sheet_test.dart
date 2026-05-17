import 'dart:async';

import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/presentation/place_detail_sheet.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('PlaceDetailSheet renders place metadata and empty memories', (
    tester,
  ) async {
    await tester.pumpWidget(
      _TestApp(
        memoryRepository: _FakeMemoryRepository(const []),
        child: PlaceDetailSheet(place: _place(memoryCount: 0)),
      ),
    );
    await tester.pump();

    expect(find.text('Old Courtyard'), findsOneWidget);
    expect(find.text('0 memories'), findsOneWidget);
    expect(find.text('Custodians'), findsOneWidget);
    expect(find.text('custodian-1'), findsOneWidget);
    expect(find.text('No memories saved here yet.'), findsOneWidget);
    expect(
      find.text('Add the first memory nearby to start this place archive.'),
      findsOneWidget,
    );
  });

  testWidgets('PlaceDetailSheet renders memories for the place', (
    tester,
  ) async {
    await tester.pumpWidget(
      _TestApp(
        memoryRepository: _FakeMemoryRepository([_memory()]),
        child: PlaceDetailSheet(place: _place(memoryCount: 1)),
      ),
    );

    await tester.pump();

    expect(find.text('1 memories'), findsOneWidget);
    expect(find.text('A quiet afternoon under the rain tree.'), findsOneWidget);
    expect(find.text('Public'), findsOneWidget);
  });

  testWidgets('PlaceDetailSheet renders loading state while memories load', (
    tester,
  ) async {
    final controller = StreamController<List<Memory>>();
    addTearDown(controller.close);

    await tester.pumpWidget(
      _TestApp(
        memoryRepository: _FakeMemoryRepository.fromStream(controller.stream),
        child: PlaceDetailSheet(place: _place(memoryCount: 1)),
      ),
    );

    expect(find.text('Loading place memories'), findsOneWidget);

    controller.add([_memory()]);
    await tester.pump();

    expect(find.text('A quiet afternoon under the rain tree.'), findsOneWidget);
  });
}

class _TestApp extends StatelessWidget {
  const _TestApp({required this.memoryRepository, required this.child});

  final MemoryRepository memoryRepository;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RepositoryProvider<MemoryRepository>.value(
      value: memoryRepository,
      child: MaterialApp(home: Scaffold(body: child)),
    );
  }
}

class _FakeMemoryRepository implements MemoryRepository {
  const _FakeMemoryRepository(this.memories) : _memoryStream = null;

  const _FakeMemoryRepository.fromStream(this._memoryStream)
    : memories = const [];

  final List<Memory> memories;
  final Stream<List<Memory>>? _memoryStream;

  @override
  Future<void> create(Memory memory) async {}

  @override
  Future<Memory?> findById(String id) async => null;

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
    final memoryStream = _memoryStream;
    if (memoryStream != null) {
      return memoryStream;
    }
    return Stream.value(memories);
  }

  @override
  Stream<List<Memory>> watchMemoriesForUser(String userId) {
    return Stream.value(const []);
  }

  @override
  Stream<List<Memory>> watchVisibleMemoriesForPlace({
    required String placeId,
    required String viewerId,
    required Set<String> viewerCommunityIds,
    required DateTime now,
  }) {
    return Stream.value(memories);
  }
}

Place _place({required int memoryCount}) {
  final now = DateTime.utc(2026, 5, 17);
  return Place(
    id: 'place-1',
    name: 'Old Courtyard',
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: 'tdr1v',
    custodianIds: const ['custodian-1'],
    aura: AuraZone.empty(now),
    memoryCount: memoryCount,
    publicMemoryCount: memoryCount,
    createdAt: now,
    updatedAt: now,
  );
}

Memory _memory() {
  return Memory(
    id: 'memory-1',
    userId: 'user-1',
    placeId: 'place-1',
    textContent: 'A quiet afternoon under the rain tree.',
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: 'tdr1v',
    sentiment: const SentimentResult(
      compound: 0.3,
      positive: 0.4,
      neutral: 0.6,
      negative: 0,
    ),
    privacy: PrivacyType.public,
    taggedUserIds: const [],
    isDeleted: false,
    createdAt: DateTime.utc(2026, 5, 16),
    updatedAt: DateTime.utc(2026, 5, 16),
  );
}
