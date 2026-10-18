import 'dart:io';

import 'package:echoes/core/media/media_upload_service.dart';
import 'package:firebase_storage/firebase_storage.dart';

class FirebaseStorageMediaUploadService implements MediaUploadService {
  FirebaseStorageMediaUploadService({FirebaseStorage? storage})
    : _storage = storage ?? FirebaseStorage.instance;

  final FirebaseStorage _storage;

  @override
  Future<String?> uploadMemoryImage({
    required String userId,
    required String imagePath,
    required String memoryId,
  }) async {
    final extension = imagePath.split('.').last.toLowerCase();
    final normalizedExtension = extension == imagePath ? 'jpg' : extension;
    final ref = _storage.ref(
      'memory-images/$userId/$memoryId.$normalizedExtension',
    );
    final task = await ref.putFile(
      File(imagePath),
      SettableMetadata(contentType: 'image/$normalizedExtension'),
    );
    return task.ref.getDownloadURL();
  }

  @override
  Future<String?> uploadMemoryAudio({
    required String userId,
    required String audioPath,
    required String memoryId,
  }) async {
    final ref = _storage.ref('memory-audio/$userId/$memoryId.m4a');
    final task = await ref.putFile(
      File(audioPath),
      SettableMetadata(contentType: 'audio/mp4'),
    );
    return task.ref.getDownloadURL();
  }
}
