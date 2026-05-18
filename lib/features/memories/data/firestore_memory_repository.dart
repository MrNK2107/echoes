import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/memories/data/memory_dto.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';

class FirestoreMemoryRepository implements MemoryRepository {
  FirestoreMemoryRepository({
    FirebaseFirestore? firestore,
    this.placeMemoryLimit = defaultPlaceMemoryLimit,
    this.userMemoryLimit = defaultUserMemoryLimit,
  }) : _firestore = firestore ?? FirebaseFirestore.instance;

  static const defaultPlaceMemoryLimit = 50;
  static const defaultUserMemoryLimit = 50;
  static const maxCommunityQueryIds = 10;

  final FirebaseFirestore _firestore;
  final int placeMemoryLimit;
  final int userMemoryLimit;

  CollectionReference<Map<String, dynamic>> get _collection =>
      _firestore.collection('memories');

  @override
  Future<void> create(Memory memory) async {
    await _collection.doc(memory.id).set(MemoryDto.fromDomain(memory).toMap());
  }

  @override
  Future<Memory?> findById(String id) async {
    final snapshot = await _collection.doc(id).get();
    final data = snapshot.data();
    return data == null
        ? null
        : MemoryDto.fromMap(snapshot.id, data).toDomain();
  }

  @override
  Future<void> softDelete({
    required String memoryId,
    required DateTime deletedAt,
  }) async {
    await _collection.doc(memoryId).update({
      'isDeleted': true,
      'deletedAt': deletedAt.toUtc().toIso8601String(),
      'updatedAt': deletedAt.toUtc().toIso8601String(),
    });
  }

  @override
  Future<void> updateTextAndPrivacy({
    required String memoryId,
    required String textContent,
    required PrivacyType privacy,
    required List<String> taggedUserIds,
    required DateTime? releaseDate,
    required String? communityId,
  }) async {
    await _collection.doc(memoryId).update({
      'textContent': textContent,
      'privacy': privacy.name,
      'taggedUserIds': taggedUserIds,
      'releaseDate': releaseDate?.toUtc().toIso8601String(),
      'communityId': communityId,
      'updatedAt': DateTime.now().toUtc().toIso8601String(),
    });
  }

  @override
  Future<void> updateImageUrl({
    required String memoryId,
    required String imageUrl,
    required DateTime updatedAt,
  }) async {
    await _collection.doc(memoryId).update({
      'imageUrl': imageUrl,
      'updatedAt': updatedAt.toUtc().toIso8601String(),
    });
  }

  @override
  Stream<List<Memory>> watchMemoriesForPlace(String placeId) {
    return _collection
        .where('placeId', isEqualTo: placeId)
        .where('isDeleted', isEqualTo: false)
        .orderBy('createdAt', descending: true)
        .limit(placeMemoryLimit)
        .snapshots()
        .map(_memoriesFromSnapshot);
  }

  @override
  Stream<List<Memory>> watchMemoriesForUser(String userId) {
    return _collection
        .where('userId', isEqualTo: userId)
        .where('isDeleted', isEqualTo: false)
        .orderBy('createdAt', descending: true)
        .limit(userMemoryLimit)
        .snapshots()
        .map(_memoriesFromSnapshot);
  }

  @override
  Stream<List<Memory>> watchVisibleMemoriesForPlace({
    required String placeId,
    required String viewerId,
    required Set<String> viewerCommunityIds,
    required DateTime now,
  }) {
    return _mergeVisibleMemoryStreams([
      _publicMemoriesForPlace(placeId),
      _ownMemoriesForPlace(placeId: placeId, viewerId: viewerId),
      _taggedMemoriesForPlace(placeId: placeId, viewerId: viewerId),
      _releasedTimeReleaseMemoriesForPlace(placeId: placeId, now: now),
      if (viewerCommunityIds.isNotEmpty)
        _communityMemoriesForPlace(
          placeId: placeId,
          viewerCommunityIds: viewerCommunityIds,
        ),
    ]);
  }

  Stream<List<Memory>> _publicMemoriesForPlace(String placeId) {
    return _visiblePlaceQuery(placeId)
        .where('privacy', isEqualTo: PrivacyType.public.name)
        .limit(placeMemoryLimit)
        .snapshots()
        .map(_memoriesFromSnapshot);
  }

  Stream<List<Memory>> _ownMemoriesForPlace({
    required String placeId,
    required String viewerId,
  }) {
    return _visiblePlaceQuery(placeId)
        .where('userId', isEqualTo: viewerId)
        .limit(placeMemoryLimit)
        .snapshots()
        .map(_memoriesFromSnapshot);
  }

  Stream<List<Memory>> _taggedMemoriesForPlace({
    required String placeId,
    required String viewerId,
  }) {
    return _visiblePlaceQuery(placeId)
        .where('taggedUserIds', arrayContains: viewerId)
        .limit(placeMemoryLimit)
        .snapshots()
        .map(_memoriesFromSnapshot);
  }

  Stream<List<Memory>> _releasedTimeReleaseMemoriesForPlace({
    required String placeId,
    required DateTime now,
  }) {
    return _visiblePlaceQuery(placeId)
        .where('privacy', isEqualTo: PrivacyType.timeRelease.name)
        .where(
          'releaseDate',
          isLessThanOrEqualTo: now.toUtc().toIso8601String(),
        )
        .limit(placeMemoryLimit)
        .snapshots()
        .map(_memoriesFromSnapshot);
  }

  Stream<List<Memory>> _communityMemoriesForPlace({
    required String placeId,
    required Set<String> viewerCommunityIds,
  }) {
    return _visiblePlaceQuery(placeId)
        .where('privacy', isEqualTo: PrivacyType.community.name)
        .where(
          'communityId',
          whereIn: viewerCommunityIds.take(maxCommunityQueryIds).toList(),
        )
        .limit(placeMemoryLimit)
        .snapshots()
        .map(_memoriesFromSnapshot);
  }

  Query<Map<String, dynamic>> _visiblePlaceQuery(String placeId) {
    return _collection
        .where('placeId', isEqualTo: placeId)
        .where('isDeleted', isEqualTo: false);
  }

  Stream<List<Memory>> _mergeVisibleMemoryStreams(
    List<Stream<List<Memory>>> streams,
  ) {
    late StreamController<List<Memory>> controller;
    final latestByStream = <int, List<Memory>>{};
    final subscriptions = <StreamSubscription<List<Memory>>>[];

    void emitMerged() {
      final byId = <String, Memory>{};
      for (final memories in latestByStream.values) {
        for (final memory in memories) {
          byId[memory.id] = memory;
        }
      }
      final merged = byId.values.toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      controller.add(merged.take(placeMemoryLimit).toList(growable: false));
    }

    controller = StreamController<List<Memory>>(
      onListen: () {
        for (var index = 0; index < streams.length; index++) {
          subscriptions.add(
            streams[index].listen((memories) {
              latestByStream[index] = memories;
              emitMerged();
            }, onError: controller.addError),
          );
        }
      },
      onCancel: () async {
        for (final subscription in subscriptions) {
          await subscription.cancel();
        }
      },
    );

    return controller.stream;
  }

  List<Memory> _memoriesFromSnapshot(
    QuerySnapshot<Map<String, dynamic>> snapshot,
  ) {
    return snapshot.docs
        .map((doc) => MemoryDto.fromMap(doc.id, doc.data()).toDomain())
        .toList();
  }
}
