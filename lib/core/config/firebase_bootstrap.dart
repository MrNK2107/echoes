import 'package:echoes/firebase_options.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/widgets.dart';

class FirebaseBootstrap {
  static Future<void> initialize() async {
    WidgetsFlutterBinding.ensureInitialized();
    final options = DefaultFirebaseOptions.currentPlatform;
    if (options == null) {
      await Firebase.initializeApp();
      return;
    }

    await Firebase.initializeApp(options: options);
  }
}
