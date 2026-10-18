import * as ImagePicker from 'expo-image-picker';

import type { ImagePickerService } from './types';

export const expoImagePicker: ImagePickerService = {
  async pick(source) {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, width: asset.width, height: asset.height, fileSize: asset.fileSize ?? null };
  },
};
