import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/data/memory_dto.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('MemoryDto round-trips between domain and map', () {
    final now = DateTime.utc(2026, 5, 14, 12);
    final memory = Memory(
      id: 'memory-1',
      userId: 'user-1',
      placeId: 'place-1',
      imageUrl: 'https://example.com/memory.jpg',
      textContent: 'This courtyard remembers graduation day.',
      latitude: 12.9716,
      longitude: 77.5946,
      geohash: 'tdr1v',
      sentiment: const SentimentResult(
        compound: 0.64,
        positive: 0.7,
        neutral: 0.2,
        negative: 0.1,
      ),
      privacy: PrivacyType.public,
      taggedUserIds: const ['friend-1'],
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    );

    final map = MemoryDto.fromDomain(memory).toMap();
    final restored = MemoryDto.fromMap(memory.id, map).toDomain();

    expect(restored.id, memory.id);
    expect(restored.userId, memory.userId);
    expect(restored.textContent, memory.textContent);
    expect(restored.privacy, PrivacyType.public);
    expect(restored.sentiment.compound, 0.64);
    expect(restored.createdAt, now);
  });
}
