import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/core/config/firestore_cache_settings.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FirestoreCacheSettings', () {
    test('enables offline persistence with an unlimited local cache', () {
      const settings = FirestoreCacheSettings.offlinePersistence;

      expect(settings.persistenceEnabled, isTrue);
      expect(settings.cacheSizeBytes, Settings.CACHE_SIZE_UNLIMITED);
    });
  });
}
