abstract interface class MediaUploadService {
  Future<String?> uploadMemoryImage({
    required String userId,
    required String imagePath,
    required String memoryId,
  });

  Future<String?> uploadMemoryAudio({
    required String userId,
    required String audioPath,
    required String memoryId,
  });
}
