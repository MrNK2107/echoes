import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError(
        'Firebase options for web are not configured yet. '
        'Run FlutterFire CLI for web support.',
      );
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        throw UnsupportedError(
          'Firebase options for iOS are not configured yet. '
          'Run FlutterFire CLI for iOS support.',
        );
      case TargetPlatform.macOS:
        throw UnsupportedError(
          'Firebase options for macOS are not configured yet. '
          'Run FlutterFire CLI for macOS support.',
        );
      case TargetPlatform.windows:
        throw UnsupportedError(
          'Firebase options for Windows are not configured yet. '
          'Run FlutterFire CLI for Windows support.',
        );
      case TargetPlatform.linux:
        throw UnsupportedError(
          'Firebase options for Linux are not configured yet. '
          'Run FlutterFire CLI for Linux support.',
        );
      case TargetPlatform.fuchsia:
        throw UnsupportedError('Firebase is not configured for Fuchsia.');
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCs9zKv84D957Lu4309vrViA8OMsxAIW-0',
    appId: '1:1078284126632:android:173f8d5f27ef790edaf59d',
    messagingSenderId: '1078284126632',
    projectId: 'echoes-d0cef',
    storageBucket: 'echoes-d0cef.firebasestorage.app',
  );
}