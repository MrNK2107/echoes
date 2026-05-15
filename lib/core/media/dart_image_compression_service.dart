import 'dart:io';
import 'dart:math';

import 'package:echoes/core/media/image_compression_service.dart';
import 'package:image/image.dart' as image;

class DartImageCompressionService implements ImageCompressionService {
  DartImageCompressionService({
    this.maxBytes = 1024 * 1024,
    Directory? outputDirectory,
  }) : _outputDirectory = outputDirectory;

  final int maxBytes;
  final Directory? _outputDirectory;

  @override
  Future<String> compressToUploadLimit(String imagePath) async {
    final source = File(imagePath);
    final originalBytes = await source.readAsBytes();
    if (originalBytes.lengthInBytes <= maxBytes) {
      return imagePath;
    }

    final decoded = image.decodeImage(originalBytes);
    if (decoded == null) {
      throw const ImageCompressionException('Unsupported image format.');
    }

    var current = decoded;
    for (final quality in const [85, 75, 65, 55, 45, 35]) {
      final encoded = image.encodeJpg(current, quality: quality);
      if (encoded.length <= maxBytes) {
        return _writeCompressedImage(encoded, source);
      }
    }

    while (current.width > 320 || current.height > 320) {
      final encoded = image.encodeJpg(current, quality: 35);
      final scale = sqrt(maxBytes / encoded.length).clamp(0.25, 0.85);
      current = image.copyResize(
        current,
        width: max(1, (current.width * scale).floor()),
        height: max(1, (current.height * scale).floor()),
        interpolation: image.Interpolation.average,
      );

      final resized = image.encodeJpg(current, quality: 35);
      if (resized.length <= maxBytes) {
        return _writeCompressedImage(resized, source);
      }
    }

    throw ImageCompressionException(
      'Could not compress image below ${maxBytes ~/ 1024}KB.',
    );
  }

  Future<String> _writeCompressedImage(List<int> bytes, File source) async {
    final directory = _outputDirectory ?? Directory.systemTemp;
    if (!directory.existsSync()) {
      await directory.create(recursive: true);
    }

    final filename =
        '${source.uri.pathSegments.last.split('.').first}-compressed-${DateTime.now().microsecondsSinceEpoch}.jpg';
    final file = File('${directory.path}${Platform.pathSeparator}$filename');
    await file.writeAsBytes(bytes, flush: true);
    return file.path;
  }
}

class ImageCompressionException implements Exception {
  const ImageCompressionException(this.message);

  final String message;

  @override
  String toString() => message;
}
