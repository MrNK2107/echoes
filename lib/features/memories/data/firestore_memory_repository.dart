import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/memories/data/memory_dto.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';

class FirestoreMemoryRepository implements MemoryRepository {
  FirestoreMemoryRepository({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

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
  Stream<List<Memory>> watchMemoriesForPlace(String placeId) {
    return _collection
        .where('placeId', isEqualTo: placeId)
        .where('isDeleted', isEqualTo: false)
        .snapshots()
        .map(_memoriesFromSnapshot);
  }

  @override
  Stream<List<Memory>> watchMemoriesForUser(String userId) {
    return _collection
        .where('userId', isEqualTo: userId)
        .where('isDeleted', isEqualTo: false)
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
    return watchMemoriesForPlace(placeId).map((memories) {
      return memories.where((memory) {
        final communityId = memory.communityId;
        return memory.isVisibleTo(
          viewerId: viewerId,
          viewerIsCommunityMember:
              communityId != null && viewerCommunityIds.contains(communityId),
          now: now,
        );
      }).toList();
    });
  }

  List<Memory> _memoriesFromSnapshot(
    QuerySnapshot<Map<String, dynamic>> snapshot,
  ) {
    return snapshot.docs
        .map((doc) => MemoryDto.fromMap(doc.id, doc.data()).toDomain())
        .toList();
  }
}
