import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/core/config/firestore_cache_settings.dart';
import 'package:echoes/firebase_options.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/widgets.dart';

class FirebaseBootstrap {
  static Future<void> initialize() async {
    WidgetsFlutterBinding.ensureInitialized();
    final options = DefaultFirebaseOptions.currentPlatform;
    if (options == null) {
      await Firebase.initializeApp();
      FirestoreCacheSettings.apply(FirebaseFirestore.instance);
      return;
    }

    await Firebase.initializeApp(options: options);
    FirestoreCacheSettings.apply(FirebaseFirestore.instance);
  }
}
