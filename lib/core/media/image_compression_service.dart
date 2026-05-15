abstract interface class ImageCompressionService {
  Future<String> compressToUploadLimit(String imagePath);
}
