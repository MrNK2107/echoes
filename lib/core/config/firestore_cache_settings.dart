import 'package:cloud_firestore/cloud_firestore.dart';

class FirestoreCacheSettings {
  const FirestoreCacheSettings._();

  static const offlinePersistence = Settings(
    persistenceEnabled: true,
    cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
  );

  static void apply(FirebaseFirestore firestore) {
    firestore.settings = offlinePersistence;
  }
}
