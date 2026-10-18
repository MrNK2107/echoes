import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/institutions/data/institution_zone_dto.dart';
import 'package:echoes/features/institutions/domain/institution_repository.dart';
import 'package:echoes/features/institutions/domain/institution_zone.dart';

class FirestoreInstitutionRepository implements InstitutionRepository {
  FirestoreInstitutionRepository({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _collection =>
      _firestore.collection('institutions');

  @override
  Future<void> create(InstitutionZone zone) =>
      _collection.doc(zone.id).set(InstitutionZoneDto.toMap(zone));

  @override
  Future<InstitutionZone?> findById(String id) async {
    final snapshot = await _collection.doc(id).get();
    final data = snapshot.data();
    return data == null ? null : InstitutionZoneDto.fromMap(snapshot.id, data);
  }

  @override
  Future<void> save(InstitutionZone zone) =>
      _collection.doc(zone.id).set(InstitutionZoneDto.toMap(zone));

  @override
  Stream<List<InstitutionZone>> watchInstitutions() {
    return _collection
        .orderBy('name')
        .limit(100)
        .snapshots()
        .map(
          (snapshot) => [
            for (final doc in snapshot.docs)
              InstitutionZoneDto.fromMap(doc.id, doc.data()),
          ],
        );
  }
}
