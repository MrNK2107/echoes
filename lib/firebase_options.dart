import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions? get currentPlatform {
    if (kIsWeb) {
      return null;
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return androidFromEnvironment;
      case TargetPlatform.iOS:
        return iosFromEnvironment;
      case TargetPlatform.macOS:
        return null;
      case TargetPlatform.windows:
        return null;
      case TargetPlatform.linux:
        return null;
      case TargetPlatform.fuchsia:
        return null;
    }
  }

  static FirebaseOptions? get androidFromEnvironment => _fromEnvironment(
    apiKey: _androidApiKey,
    appId: _androidAppId,
    messagingSenderId: _projectNumber,
    projectId: _projectId,
    storageBucket: _storageBucket,
  );

  static FirebaseOptions? get iosFromEnvironment => _fromEnvironment(
    apiKey: _iosApiKey,
    appId: _iosAppId,
    messagingSenderId: _projectNumber,
    projectId: _projectId,
    storageBucket: _storageBucket,
    iosBundleId: _iosBundleId,
  );

  static FirebaseOptions? _fromEnvironment({
    required String apiKey,
    required String appId,
    required String messagingSenderId,
    required String projectId,
    required String storageBucket,
    String? iosBundleId,
  }) {
    final requiredValues = [
      apiKey,
      appId,
      messagingSenderId,
      projectId,
      storageBucket,
    ];
    if (requiredValues.any((value) => value.isEmpty)) {
      return null;
    }

    return FirebaseOptions(
      apiKey: apiKey,
      appId: appId,
      messagingSenderId: messagingSenderId,
      projectId: projectId,
      storageBucket: storageBucket,
      iosBundleId: iosBundleId,
    );
  }

  static const _projectNumber = String.fromEnvironment(
    'FIREBASE_PROJECT_NUMBER',
  );
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const _storageBucket = String.fromEnvironment(
    'FIREBASE_STORAGE_BUCKET',
  );
  static const _androidAppId = String.fromEnvironment(
    'FIREBASE_ANDROID_APP_ID',
  );
  static const _androidApiKey = String.fromEnvironment(
    'FIREBASE_ANDROID_API_KEY',
  );
  static const _iosAppId = String.fromEnvironment('FIREBASE_IOS_APP_ID');
  static const _iosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');
  static const _iosApiKey = String.fromEnvironment('FIREBASE_IOS_API_KEY');
}
