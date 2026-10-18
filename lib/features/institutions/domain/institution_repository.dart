import 'package:echoes/features/institutions/domain/institution_zone.dart';

abstract interface class InstitutionRepository {
  Stream<List<InstitutionZone>> watchInstitutions();

  Future<InstitutionZone?> findById(String id);

  Future<void> create(InstitutionZone zone);

  Future<void> save(InstitutionZone zone);
}
