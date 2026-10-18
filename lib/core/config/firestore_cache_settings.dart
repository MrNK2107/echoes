import 'package:cloud_firestore/cloud_firestore.dart';

class FirestoreCacheSettings {
  FirestoreCacheSettings._();

  static final offlinePersistence = Settings(
    persistenceEnabled: true,
    cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
  );

  static var _applied = false;

  static void apply(FirebaseFirestore firestore) {
    if (_applied) return;
    firestore.settings = offlinePersistence;
    _applied = true;
  }
}
