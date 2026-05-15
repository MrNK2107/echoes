abstract interface class MediaUploadService {
  Future<String?> uploadMemoryImage({
    required String userId,
    required String imagePath,
    required String memoryId,
  });
}
