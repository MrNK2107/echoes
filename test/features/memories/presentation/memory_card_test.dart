import 'package:echoes/core/media/local_image_cache.dart';
import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/presentation/memory_card.dart';
import 'package:echoes/features/memories/presentation/memory_image_preview.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('MemoryCard renders content and privacy state', (tester) async {
    final memory = Memory(
      id: 'memory-1',
      userId: 'user-1',
      placeId: 'place-1',
      imageUrl: '/tmp/memory.jpg',
      textContent: 'A memory from the old courtyard.',
      latitude: 12.9716,
      longitude: 77.5946,
      geohash: 'tdr1v',
      sentiment: const SentimentResult(
        compound: 0,
        positive: 0,
        neutral: 1,
        negative: 0,
      ),
      privacy: PrivacyType.private,
      taggedUserIds: const [],
      isDeleted: false,
      createdAt: DateTime.utc(2026, 5, 14),
      updatedAt: DateTime.utc(2026, 5, 14),
    );

    await tester.pumpWidget(
      RepositoryProvider(
        create: (_) => LocalImageCache(),
        child: MaterialApp(
          home: Scaffold(body: MemoryCard(memory: memory)),
        ),
      ),
    );

    expect(find.text('Private'), findsOneWidget);
    expect(find.text('A memory from the old courtyard.'), findsOneWidget);
    expect(find.byType(MemoryImagePreview), findsOneWidget);
    expect(find.textContaining('Created by'), findsNothing);
  });

  testWidgets('MemoryCard shows creator for public memories', (tester) async {
    await tester.pumpWidget(
      RepositoryProvider(
        create: (_) => LocalImageCache(),
        child: MaterialApp(
          home: Scaffold(
            body: MemoryCard(memory: _memory(privacy: PrivacyType.public)),
          ),
        ),
      ),
    );

    expect(find.text('Created by user-1'), findsOneWidget);
  });
}

Memory _memory({required PrivacyType privacy}) {
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
      compound: 0,
      positive: 0,
      neutral: 1,
      negative: 0,
    ),
    privacy: privacy,
    taggedUserIds: const [],
    isDeleted: false,
    createdAt: DateTime.utc(2026, 5, 14),
    updatedAt: DateTime.utc(2026, 5, 14),
  );
}
