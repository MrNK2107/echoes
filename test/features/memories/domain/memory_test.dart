import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Memory visibility', () {
    final now = DateTime.utc(2026, 5, 14);

    Memory memory({
      required PrivacyType privacy,
      String creatorId = 'creator',
      List<String> taggedUserIds = const [],
      DateTime? releaseDate,
      bool isDeleted = false,
    }) {
      return Memory(
        id: 'memory-1',
        userId: creatorId,
        placeId: 'place-1',
        textContent: 'A memory held by this place.',
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
        taggedUserIds: taggedUserIds,
        releaseDate: releaseDate,
        isDeleted: isDeleted,
        createdAt: now,
        updatedAt: now,
      );
    }

    test('creator can see their own private memory', () {
      final subject = memory(privacy: PrivacyType.private);

      expect(
        subject.isVisibleTo(
          viewerId: 'creator',
          viewerIsCommunityMember: false,
          now: now,
        ),
        isTrue,
      );
    });

    test('other users cannot see private memory', () {
      final subject = memory(privacy: PrivacyType.private);

      expect(
        subject.isVisibleTo(
          viewerId: 'viewer',
          viewerIsCommunityMember: false,
          now: now,
        ),
        isFalse,
      );
    });

    test('tagged user can see tagged memory', () {
      final subject = memory(
        privacy: PrivacyType.tagged,
        taggedUserIds: const ['viewer'],
      );

      expect(
        subject.isVisibleTo(
          viewerId: 'viewer',
          viewerIsCommunityMember: false,
          now: now,
        ),
        isTrue,
      );
    });

    test('time-release memory is hidden before release date', () {
      final subject = memory(
        privacy: PrivacyType.timeRelease,
        releaseDate: now.add(const Duration(days: 1)),
      );

      expect(
        subject.isVisibleTo(
          viewerId: 'viewer',
          viewerIsCommunityMember: false,
          now: now,
        ),
        isFalse,
      );
    });

    test('time-release memory is visible after release date', () {
      final subject = memory(
        privacy: PrivacyType.timeRelease,
        releaseDate: now.subtract(const Duration(days: 1)),
      );

      expect(
        subject.isVisibleTo(
          viewerId: 'viewer',
          viewerIsCommunityMember: false,
          now: now,
        ),
        isTrue,
      );
    });

    test('deleted memory is hidden from everyone including creator', () {
      final subject = memory(privacy: PrivacyType.public, isDeleted: true);

      expect(
        subject.isVisibleTo(
          viewerId: 'creator',
          viewerIsCommunityMember: true,
          now: now,
        ),
        isFalse,
      );
    });
  });
}
