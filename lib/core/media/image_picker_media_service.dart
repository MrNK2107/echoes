import 'package:echoes/core/media/media_picker_service.dart';
import 'package:echoes/core/media/selected_media.dart';
import 'package:image_picker/image_picker.dart';

class ImagePickerMediaService implements MediaPickerService {
  ImagePickerMediaService({ImagePicker? picker})
    : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<SelectedMedia?> pickFromCamera() async {
    final file = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 82,
    );
    return file == null ? null : SelectedMedia(path: file.path);
  }

  @override
  Future<SelectedMedia?> pickFromGallery() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 82,
    );
    return file == null ? null : SelectedMedia(path: file.path);
  }
}
