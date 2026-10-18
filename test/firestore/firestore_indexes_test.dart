import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Finds the project root by searching upward for `firestore.indexes.json`.
String _findProjectRoot() {
  var dir = Directory.current;
  // Search up to 5 levels for the project root
  for (var i = 0; i < 5; i++) {
    if (File('${dir.path}/pubspec.yaml').existsSync()) {
      return dir.path;
    }
    dir = dir.parent;
  }
  return Directory.current.path;
}

Map<String, dynamic> _loadIndexes() {
  final root = _findProjectRoot();
  final file = File('$root/firestore.indexes.json');
  if (!file.existsSync()) {
    throw StateError('firestore.indexes.json not found at $root');
  }
  return json.decode(file.readAsStringSync()) as Map<String, dynamic>;
}

List<dynamic> get _indexes {
  final data = _loadIndexes();
  return data['indexes'] as List<dynamic>;
}

bool _hasIndex({
  required String collectionGroup,
  String queryScope = 'COLLECTION',
  required List<Map<String, String?>> fields,
}) {
  return _indexes.any((index) {
    final indexMap = index as Map<String, dynamic>;
    if (indexMap['collectionGroup'] != collectionGroup) {
      return false;
    }
    if (indexMap['queryScope'] != queryScope) {
      return false;
    }
    final indexFields = indexMap['fields'] as List<dynamic>;
    if (indexFields.length != fields.length) {
      return false;
    }
    for (var i = 0; i < fields.length; i++) {
      final indexField = indexFields[i] as Map<String, dynamic>;
      final expectedField = fields[i];
      // Accept either order or arrayConfig match
      if (indexField['fieldPath'] != expectedField['fieldPath']) {
        return false;
      }
      if (expectedField['order'] != null &&
          indexField['order'] != expectedField['order']) {
        return false;
      }
      if (expectedField['arrayConfig'] != null &&
          indexField['arrayConfig'] != expectedField['arrayConfig']) {
        return false;
      }
    }
    return true;
  });
}

void main() {
  late List<dynamic> indexes;

  setUp(() {
    final data = _loadIndexes();
    indexes = data['indexes'] as List<dynamic>;
    expect(indexes, isNotEmpty, reason: 'Must have at least one index');
  });

  group('memories collection indexes', () {
    test('covers placeId + isDeleted + createdAt (desc)', () {
      expect(
        _hasIndex(
          collectionGroup: 'memories',
          fields: [
            {'fieldPath': 'placeId', 'order': 'ASCENDING'},
            {'fieldPath': 'isDeleted', 'order': 'ASCENDING'},
            {'fieldPath': 'createdAt', 'order': 'DESCENDING'},
          ],
        ),
        isTrue,
        reason:
            'Missing compound index for watchMemoriesForPlace query: '
            '.where("placeId", ==).where("isDeleted", ==).orderBy("createdAt", desc)',
      );
    });

    test('covers placeId + isDeleted + privacy (flat query)', () {
      expect(
        _hasIndex(
          collectionGroup: 'memories',
          fields: [
            {'fieldPath': 'placeId', 'order': 'ASCENDING'},
            {'fieldPath': 'isDeleted', 'order': 'ASCENDING'},
            {'fieldPath': 'privacy', 'order': 'ASCENDING'},
          ],
        ),
        isTrue,
        reason:
            'Missing compound index for privacy-filtered queries: '
            '.where("placeId", ==).where("isDeleted", ==).where("privacy", ==)',
      );
    });

    test('covers placeId + isDeleted + userId', () {
      expect(
        _hasIndex(
          collectionGroup: 'memories',
          fields: [
            {'fieldPath': 'placeId', 'order': 'ASCENDING'},
            {'fieldPath': 'isDeleted', 'order': 'ASCENDING'},
            {'fieldPath': 'userId', 'order': 'ASCENDING'},
          ],
        ),
        isTrue,
        reason:
            'Missing compound index for own-memories query: '
            '.where("placeId", ==).where("isDeleted", ==).where("userId", ==)',
      );
    });

    test('covers placeId + isDeleted + taggedUserIds (array-contains)', () {
      expect(
        _hasIndex(
          collectionGroup: 'memories',
          fields: [
            {'fieldPath': 'placeId', 'order': 'ASCENDING'},
            {'fieldPath': 'isDeleted', 'order': 'ASCENDING'},
            {'fieldPath': 'taggedUserIds', 'arrayConfig': 'CONTAINS'},
          ],
        ),
        isTrue,
        reason:
            'Missing compound index for tagged-memories query: '
            '.where("placeId", ==).where("isDeleted", ==).where("taggedUserIds", arrayContains)',
      );
    });

    test('covers placeId + isDeleted + privacy + releaseDate', () {
      expect(
        _hasIndex(
          collectionGroup: 'memories',
          fields: [
            {'fieldPath': 'placeId', 'order': 'ASCENDING'},
            {'fieldPath': 'isDeleted', 'order': 'ASCENDING'},
            {'fieldPath': 'privacy', 'order': 'ASCENDING'},
            {'fieldPath': 'releaseDate', 'order': 'ASCENDING'},
          ],
        ),
        isTrue,
        reason:
            'Missing compound index for time-release query: '
            '.where("placeId", ==).where("isDeleted", ==).where("privacy", ==)'
            '.where("releaseDate", <=)',
      );
    });

    test('covers placeId + isDeleted + privacy + communityId', () {
      expect(
        _hasIndex(
          collectionGroup: 'memories',
          fields: [
            {'fieldPath': 'placeId', 'order': 'ASCENDING'},
            {'fieldPath': 'isDeleted', 'order': 'ASCENDING'},
            {'fieldPath': 'privacy', 'order': 'ASCENDING'},
            {'fieldPath': 'communityId', 'order': 'ASCENDING'},
          ],
        ),
        isTrue,
        reason:
            'Missing compound index for community-memories query: '
            '.where("placeId", ==).where("isDeleted", ==).where("privacy", ==)'
            '.where("communityId", "in")',
      );
    });

    test('covers userId + isDeleted + createdAt (desc)', () {
      expect(
        _hasIndex(
          collectionGroup: 'memories',
          fields: [
            {'fieldPath': 'userId', 'order': 'ASCENDING'},
            {'fieldPath': 'isDeleted', 'order': 'ASCENDING'},
            {'fieldPath': 'createdAt', 'order': 'DESCENDING'},
          ],
        ),
        isTrue,
        reason:
            'Missing compound index for watchMemoriesForUser query: '
            '.where("userId", ==).where("isDeleted", ==).orderBy("createdAt", desc)',
      );
    });
  });

  group('transfers collection indexes', () {
    test('covers toUserId + status', () {
      expect(
        _hasIndex(
          collectionGroup: 'transfers',
          fields: [
            {'fieldPath': 'toUserId', 'order': 'ASCENDING'},
            {'fieldPath': 'status', 'order': 'ASCENDING'},
          ],
        ),
        isTrue,
        reason:
            'Missing compound index for transfer queries: '
            '.where("toUserId", ==).where("status", ==)',
      );
    });
  });

  group('communities collection group indexes', () {
    test('covers members collection group by document ID', () {
      expect(
        _hasIndex(
          collectionGroup: 'members',
          queryScope: 'COLLECTION_GROUP',
          fields: [
            {'fieldPath': '__name__', 'order': 'ASCENDING'},
          ],
        ),
        isTrue,
        reason:
            'Missing collection group index for watchUserCommunities: '
            'collectionGroup("members").where(FieldPath.documentId, ==)',
      );
    });
  });

  group('places collection indexes', () {
    test('covers geohash range query', () {
      expect(
        _hasIndex(
          collectionGroup: 'places',
          fields: [
            {'fieldPath': 'geohash', 'order': 'ASCENDING'},
          ],
        ),
        isTrue,
        reason:
            'Missing index for place geo-query: '
            '.where("geohash", >=).where("geohash", <)',
      );
    });
  });
}
