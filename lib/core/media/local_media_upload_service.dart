import 'package:echoes/core/media/media_upload_service.dart';

class LocalMediaUploadService implements MediaUploadService {
  const LocalMediaUploadService();

  @override
  Future<String?> uploadMemoryImage({
    required String userId,
    required String imagePath,
    required String memoryId,
  }) async {
    return imagePath;
  }
}
