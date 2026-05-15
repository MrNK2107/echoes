import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/presentation/memory_detail_sheet.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'MemoryDetailSheet renders memory details and restore placeholder',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MemoryDetailSheet(
              memory: _memory(),
              onEdit: () {},
              onDelete: () {},
            ),
          ),
        ),
      );

      expect(find.text('Public'), findsOneWidget);
      expect(find.text('A memory from the old courtyard.'), findsOneWidget);
      expect(find.text('Photo: /tmp/memory.jpg'), findsOneWidget);
      expect(find.byKey(const ValueKey('editMemoryButton')), findsOneWidget);
      expect(find.byKey(const ValueKey('deleteMemoryButton')), findsOneWidget);
      expect(
        find.byKey(const ValueKey('restoreMemoryPlaceholderButton')),
        findsOneWidget,
      );
    },
  );
}

Memory _memory() {
  return Memory(
    id: 'memory-1',
    userId: 'user-1',
    placeId: 'place-1',
    imageUrl: '/tmp/memory.jpg',
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
    privacy: PrivacyType.public,
    taggedUserIds: const [],
    isDeleted: false,
    createdAt: DateTime.utc(2026, 5, 14),
    updatedAt: DateTime.utc(2026, 5, 14),
  );
}
