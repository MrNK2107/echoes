import 'package:echoes/core/geo/geohash.dart';
import 'package:echoes/core/media/media_upload_service.dart';
import 'package:echoes/features/aura/domain/sentiment_result.dart';
import 'package:echoes/features/memories/application/pending_memory_upload_sync.dart';
import 'package:echoes/features/memories/data/local_memory_repository.dart';
import 'package:echoes/features/memories/data/local_pending_memory_upload_queue.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/pending_memory_upload.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PendingMemoryUploadSync', () {
    test('retries queued uploads and updates memory image URL', () async {
      final now = DateTime.utc(2026, 5, 16);
      final memoryRepository = LocalMemoryRepository();
      final queue = LocalPendingMemoryUploadQueue();
      final sync = PendingMemoryUploadSync(
        queue: queue,
        mediaUploadService: _SuccessfulUploadService(),
        memoryRepository: memoryRepository,
      );

      await memoryRepository.create(_memory(now: now));
      await queue.enqueue(
        PendingMemoryUpload(
          memoryId: 'memory-1',
          userId: 'user-1',
          imagePath: '/tmp/memory.jpg',
          createdAt: now,
        ),
      );

      final completed = await sync.retryPendingUploads();

      final memory = await memoryRepository.findById('memory-1');
      expect(completed, 1);
      expect(memory?.imageUrl, 'https://cdn.example.com/memory-1.jpg');
      expect(await queue.pendingUploads(), isEmpty);

      memoryRepository.dispose();
      queue.dispose();
    });

    test('keeps failed uploads queued and records attempt', () async {
      final now = DateTime.utc(2026, 5, 16);
      final memoryRepository = LocalMemoryRepository();
      final queue = LocalPendingMemoryUploadQueue();
      final sync = PendingMemoryUploadSync(
        queue: queue,
        mediaUploadService: _FailingUploadService(),
        memoryRepository: memoryRepository,
      );

      await memoryRepository.create(_memory(now: now));
      await queue.enqueue(
        PendingMemoryUpload(
          memoryId: 'memory-1',
          userId: 'user-1',
          imagePath: '/tmp/memory.jpg',
          createdAt: now,
        ),
      );

      final completed = await sync.retryPendingUploads();
      final pending = await queue.pendingUploads();

      expect(completed, 0);
      expect(pending.single.attempts, 1);
      expect(pending.single.lastAttemptAt, isNotNull);

      memoryRepository.dispose();
      queue.dispose();
    });
  });
}

Memory _memory({required DateTime now}) {
  return Memory(
    id: 'memory-1',
    userId: 'user-1',
    placeId: 'place-1',
    textContent: 'A memory waiting for its image.',
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: Geohash.encode(latitude: 12.9716, longitude: 77.5946),
    sentiment: const SentimentResult(
      compound: 0.2,
      positive: 0.4,
      neutral: 0.6,
      negative: 0,
    ),
    privacy: PrivacyType.public,
    taggedUserIds: const [],
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  );
}

class _SuccessfulUploadService implements MediaUploadService {
  @override
  Future<String?> uploadMemoryImage({
    required String userId,
    required String imagePath,
    required String memoryId,
  }) async {
    return 'https://cdn.example.com/$memoryId.jpg';
  }
}

class _FailingUploadService implements MediaUploadService {
  @override
  Future<String?> uploadMemoryImage({
    required String userId,
    required String imagePath,
    required String memoryId,
  }) async {
    throw StateError('offline');
  }
}
