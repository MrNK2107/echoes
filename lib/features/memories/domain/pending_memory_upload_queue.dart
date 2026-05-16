import 'package:echoes/features/memories/domain/pending_memory_upload.dart';

abstract interface class PendingMemoryUploadQueue {
  Stream<List<PendingMemoryUpload>> watchPendingUploads();

  Future<List<PendingMemoryUpload>> pendingUploads();

  Future<void> enqueue(PendingMemoryUpload upload);

  Future<void> recordAttempt({
    required String memoryId,
    required DateTime attemptedAt,
  });

  Future<void> remove(String memoryId);
}
