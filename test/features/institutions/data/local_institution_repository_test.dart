import 'package:echoes/features/institutions/data/local_institution_repository.dart';
import 'package:echoes/features/institutions/domain/institution_zone.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LocalInstitutionRepository', () {
    test('create and findById work correctly', () async {
      final repo = LocalInstitutionRepository();
      final zone = InstitutionZone(
        id: 'test-college',
        name: 'Test College',
        allowedEmailDomains: ['test.edu'],
      );

      await repo.create(zone);
      final found = await repo.findById('test-college');

      expect(found?.name, 'Test College');
      expect(found?.allowedEmailDomains, ['test.edu']);
      repo.dispose();
    });

    test('watchInstitutions emits updates on create', () async {
      final repo = LocalInstitutionRepository();

      final first = await repo.watchInstitutions().first;
      expect(first, isEmpty);

      await repo.create(
        const InstitutionZone(
          id: 'uni-1',
          name: 'University One',
          allowedEmailDomains: ['uni.edu'],
        ),
      );

      final second = await repo.watchInstitutions().first;
      expect(second, hasLength(1));
      expect(second.single.id, 'uni-1');
      repo.dispose();
    });

    test('save updates existing zone', () async {
      final repo = LocalInstitutionRepository();
      await repo.create(
        InstitutionZone(
          id: 'college',
          name: 'Old Name',
          allowedEmailDomains: ['college.edu'],
        ),
      );

      await repo.save(
        InstitutionZone(
          id: 'college',
          name: 'New Name',
          allowedEmailDomains: ['college.edu', 'alumni.college.edu'],
          verifiedAdminUserIds: ['admin-1'],
        ),
      );

      final updated = await repo.findById('college');
      expect(updated?.name, 'New Name');
      expect(updated?.allowedEmailDomains, hasLength(2));
      expect(updated?.verifiedAdminUserIds, ['admin-1']);
      repo.dispose();
    });
  });
}
