import 'dart:io';

import 'package:echoes/core/media/dart_image_compression_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as image;

void main() {
  group('DartImageCompressionService', () {
    test(
      'returns original path when image already fits upload limit',
      () async {
        final tempDir = await Directory.systemTemp.createTemp(
          'echoes-compression-small',
        );
        final source = File(
          '${tempDir.path}${Platform.pathSeparator}small.jpg',
        );
        await source.writeAsBytes(
          image.encodeJpg(image.Image(width: 12, height: 12)),
        );
        final service = DartImageCompressionService(
          maxBytes: 1024 * 1024,
          outputDirectory: tempDir,
        );

        final result = await service.compressToUploadLimit(source.path);

        expect(result, source.path);
        await tempDir.delete(recursive: true);
      },
    );

    test('writes compressed image under upload limit', () async {
      final tempDir = await Directory.systemTemp.createTemp(
        'echoes-compression-large',
      );
      final source = File('${tempDir.path}${Platform.pathSeparator}large.bmp');
      await source.writeAsBytes(image.encodeBmp(_busyImage()));
      final service = DartImageCompressionService(
        maxBytes: 50 * 1024,
        outputDirectory: tempDir,
      );

      final result = await service.compressToUploadLimit(source.path);
      final compressed = File(result);

      expect(result, isNot(source.path));
      expect(await compressed.length(), lessThanOrEqualTo(50 * 1024));
      await tempDir.delete(recursive: true);
    });

    test('resizes oversized images before upload compression', () async {
      final tempDir = await Directory.systemTemp.createTemp(
        'echoes-compression-dimensions',
      );
      final source = File('${tempDir.path}${Platform.pathSeparator}wide.bmp');
      await source.writeAsBytes(
        image.encodeBmp(image.Image(width: 1800, height: 900)),
      );
      final service = DartImageCompressionService(
        maxBytes: 120 * 1024,
        maxDimension: 600,
        outputDirectory: tempDir,
      );

      final result = await service.compressToUploadLimit(source.path);
      final compressed = image.decodeImage(await File(result).readAsBytes());

      expect(result, isNot(source.path));
      expect(compressed, isNotNull);
      expect(compressed!.width, lessThanOrEqualTo(600));
      expect(compressed.height, lessThanOrEqualTo(600));
      expect(await File(result).length(), lessThanOrEqualTo(120 * 1024));
      await tempDir.delete(recursive: true);
    });
  });
}

image.Image _busyImage() {
  final bitmap = image.Image(width: 800, height: 800);
  for (var y = 0; y < bitmap.height; y++) {
    for (var x = 0; x < bitmap.width; x++) {
      bitmap.setPixelRgb(
        x,
        y,
        (x * 13 + y * 7) % 256,
        (x * 3 + y * 17) % 256,
        (x * 19 + y * 5) % 256,
      );
    }
  }
  return bitmap;
}
