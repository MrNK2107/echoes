import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/communities/data/community_dto.dart';
import 'package:echoes/features/communities/data/community_membership_dto.dart';
import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_membership.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/communities/domain/community_role.dart';

class FirestoreCommunityRepository implements CommunityRepository {
  FirestoreCommunityRepository({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _communities =>
      _firestore.collection('communities');

  DocumentReference<Map<String, dynamic>> _membershipRef({
    required String communityId,
    required String userId,
  }) {
    return _communities.doc(communityId).collection('members').doc(userId);
  }

  @override
  Future<void> create(Community community) async {
    final now = DateTime.now().toUtc();
    final batch = _firestore.batch();
    final communityRef = _communities.doc(community.id);
    final ownerMembership = CommunityMembership(
      communityId: community.id,
      userId: community.ownerId,
      role: CommunityRole.owner,
      joinedAt: now,
      updatedAt: now,
    );

    batch.set(communityRef, CommunityDto.fromDomain(community).toMap());
    batch.set(
      _membershipRef(communityId: community.id, userId: community.ownerId),
      CommunityMembershipDto.fromDomain(ownerMembership).toMap(),
    );
    await batch.commit();
  }

  @override
  Future<Community?> findById(String id) async {
    final snapshot = await _communities.doc(id).get();
    final data = snapshot.data();
    if (data == null) {
      return null;
    }
    return CommunityDto.fromMap(snapshot.id, data).toDomain();
  }

  @override
  Future<CommunityMembership?> findMembership({
    required String communityId,
    required String userId,
  }) async {
    final snapshot = await _membershipRef(
      communityId: communityId,
      userId: userId,
    ).get();
    final data = snapshot.data();
    if (data == null) {
      return null;
    }
    return CommunityMembershipDto.fromMap(communityId, userId, data).toDomain();
  }

  @override
  Future<void> join({
    required String communityId,
    required String userId,
    required CommunityRole role,
  }) async {
    final communityRef = _communities.doc(communityId);
    final membershipRef = _membershipRef(communityId: communityId, userId: userId);
    final now = DateTime.now().toUtc();

    await _firestore.runTransaction((transaction) async {
      final membershipSnapshot = await transaction.get(membershipRef);
      final existingData = membershipSnapshot.data();

      if (existingData != null) {
        final existing = CommunityMembershipDto.fromMap(
          communityId,
          userId,
          existingData,
        );
        transaction.update(membershipRef, {
          'role': role.name,
          'joinedAt': existing.joinedAt.toUtc().toIso8601String(),
          'updatedAt': now.toIso8601String(),
        });
        return;
      }

      final membership = CommunityMembership(
        communityId: communityId,
        userId: userId,
        role: role,
        joinedAt: now,
        updatedAt: now,
      );
      transaction.set(
        membershipRef,
        CommunityMembershipDto.fromDomain(membership).toMap(),
      );
      transaction.update(communityRef, {
        'memberCount': FieldValue.increment(1),
        'updatedAt': now.toIso8601String(),
      });
    });
  }

  @override
  Stream<List<Community>> watchCommunities() {
    return _communities.snapshots().map((snapshot) {
      return snapshot.docs
          .map((doc) => CommunityDto.fromMap(doc.id, doc.data()).toDomain())
          .toList();
    });
  }

  @override
  Stream<List<Community>> watchUserCommunities(String userId) {
    return _firestore
        .collectionGroup('members')
        .where(FieldPath.documentId, isEqualTo: userId)
        .snapshots()
        .asyncMap((membershipSnapshot) async {
          final futures = membershipSnapshot.docs.map((membershipDoc) async {
            final communityRef = membershipDoc.reference.parent.parent;
            if (communityRef == null) {
              return null;
            }
            final communitySnapshot = await communityRef.get();
            final data = communitySnapshot.data();
            if (data == null) {
              return null;
            }
            return CommunityDto.fromMap(communitySnapshot.id, data).toDomain();
          }).toList();

          final communities = await Future.wait(futures);
          return communities.whereType<Community>().toList();
        });
  }
}
