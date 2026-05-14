import 'package:echoes/core/media/selected_media.dart';

abstract interface class MediaPickerService {
  Future<SelectedMedia?> pickFromCamera();

  Future<SelectedMedia?> pickFromGallery();
}
