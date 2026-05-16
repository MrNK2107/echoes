import 'package:echoes/features/memories/data/local_pending_memory_upload_queue.dart';
import 'package:echoes/features/memories/domain/pending_memory_upload.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LocalPendingMemoryUploadQueue', () {
    test('emits enqueue, attempt, and removal state changes', () async {
      final queue = LocalPendingMemoryUploadQueue();
      final now = DateTime.utc(2026, 5, 16);

      await queue.enqueue(
        PendingMemoryUpload(
          memoryId: 'memory-1',
          userId: 'user-1',
          imagePath: '/tmp/memory.jpg',
          createdAt: now,
        ),
      );

      expect(await queue.pendingUploads(), hasLength(1));

      await queue.recordAttempt(
        memoryId: 'memory-1',
        attemptedAt: now.add(const Duration(minutes: 1)),
      );

      final attempted = await queue.pendingUploads();
      expect(attempted.single.attempts, 1);
      expect(
        attempted.single.lastAttemptAt,
        now.add(const Duration(minutes: 1)),
      );

      await queue.remove('memory-1');

      expect(await queue.pendingUploads(), isEmpty);
      queue.dispose();
    });
  });
}
