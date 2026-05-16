import 'dart:async';

import 'package:echoes/features/memories/domain/pending_memory_upload.dart';
import 'package:echoes/features/memories/domain/pending_memory_upload_queue.dart';

class LocalPendingMemoryUploadQueue implements PendingMemoryUploadQueue {
  final List<PendingMemoryUpload> _uploads = [];
  final _controller = StreamController<List<PendingMemoryUpload>>.broadcast();

  @override
  Future<void> enqueue(PendingMemoryUpload upload) async {
    final index = _uploads.indexWhere(
      (current) => current.memoryId == upload.memoryId,
    );
    if (index == -1) {
      _uploads.add(upload);
    } else {
      _uploads[index] = upload;
    }
    _emit();
  }

  @override
  Future<List<PendingMemoryUpload>> pendingUploads() async {
    return List.unmodifiable(_uploads);
  }

  @override
  Future<void> recordAttempt({
    required String memoryId,
    required DateTime attemptedAt,
  }) async {
    final index = _uploads.indexWhere((upload) => upload.memoryId == memoryId);
    if (index == -1) {
      return;
    }

    final upload = _uploads[index];
    _uploads[index] = upload.copyWith(
      attempts: upload.attempts + 1,
      lastAttemptAt: attemptedAt,
    );
    _emit();
  }

  @override
  Future<void> remove(String memoryId) async {
    _uploads.removeWhere((upload) => upload.memoryId == memoryId);
    _emit();
  }

  @override
  Stream<List<PendingMemoryUpload>> watchPendingUploads() async* {
    yield List.unmodifiable(_uploads);
    yield* _controller.stream;
  }

  void _emit() {
    _controller.add(List.unmodifiable(_uploads));
  }

  void dispose() {
    _controller.close();
  }
}
