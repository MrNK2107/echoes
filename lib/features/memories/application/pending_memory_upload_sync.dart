import 'package:echoes/core/media/media_upload_service.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/domain/pending_memory_upload_queue.dart';

class PendingMemoryUploadSync {
  const PendingMemoryUploadSync({
    required PendingMemoryUploadQueue queue,
    required MediaUploadService mediaUploadService,
    required MemoryRepository memoryRepository,
  }) : _queue = queue,
       _mediaUploadService = mediaUploadService,
       _memoryRepository = memoryRepository;

  final PendingMemoryUploadQueue _queue;
  final MediaUploadService _mediaUploadService;
  final MemoryRepository _memoryRepository;

  Future<int> retryPendingUploads() async {
    var completed = 0;
    final uploads = await _queue.pendingUploads();

    for (final upload in uploads) {
      final attemptedAt = DateTime.now().toUtc();
      try {
        await _queue.recordAttempt(
          memoryId: upload.memoryId,
          attemptedAt: attemptedAt,
        );
        final imageUrl = await _mediaUploadService.uploadMemoryImage(
          userId: upload.userId,
          imagePath: upload.imagePath,
          memoryId: upload.memoryId,
        );
        if (imageUrl == null) {
          continue;
        }

        await _memoryRepository.updateImageUrl(
          memoryId: upload.memoryId,
          imageUrl: imageUrl,
          updatedAt: DateTime.now().toUtc(),
        );
        await _queue.remove(upload.memoryId);
        completed += 1;
      } on Object {
        continue;
      }
    }

    return completed;
  }
}
