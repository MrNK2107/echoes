import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/core/config/firestore_cache_settings.dart';
import 'package:echoes/firebase_options.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/widgets.dart';

class FirebaseBootstrap {
  static const _initTimeout = Duration(seconds: 15);

  static Future<void> initialize() async {
    WidgetsFlutterBinding.ensureInitialized();

    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
    } on Object {
      try {
        await Firebase.initializeApp().timeout(_initTimeout);
      } on Object {
        // Firebase failed to initialize without explicit options either.
        // The app will work in degraded mode with local repositories.
        return;
      }
    }

    try {
      // Settings must be applied before any Firestore operation.
      // If Firestore was already touched (e.g., by a plugin), this throws.
      FirestoreCacheSettings.apply(FirebaseFirestore.instance);
    } on Object {
      // Firestore already started — cache settings are at plugin defaults.
    }
  }
}
