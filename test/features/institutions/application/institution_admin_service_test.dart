import 'package:echoes/features/institutions/application/institution_admin_service.dart';
import 'package:echoes/features/institutions/domain/campus_sub_zone.dart';
import 'package:echoes/features/institutions/domain/institution_zone.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('InstitutionAdminService', () {
    const service = InstitutionAdminService();
    const institution = InstitutionZone(
      id: 'uv-college',
      name: 'UV College',
      allowedEmailDomains: ['uv.edu', 'alumni.uv.edu'],
    );

    test('validates alumni email domains case-insensitively', () {
      expect(
        service.isAlumniEmail(
          email: 'Nanda@Alumni.UV.edu',
          institution: institution,
        ),
        isTrue,
      );
      expect(
        service.isAlumniEmail(
          email: 'nanda@example.com',
          institution: institution,
        ),
        isFalse,
      );
    });

    test('verifies institution admins with approved domains', () {
      final verified = service.verifyAdmin(
        institution: institution,
        userId: 'admin-1',
        email: 'admin@uv.edu',
      );

      expect(verified.verifiedAdminUserIds, ['admin-1']);
    });

    test('restricts building sub-zone creation to verified admins', () {
      final verified = service.verifyAdmin(
        institution: institution,
        userId: 'admin-1',
        email: 'admin@uv.edu',
      );
      final withSubZone = service.addSubZone(
        institution: verified,
        adminUserId: 'admin-1',
        subZone: const CampusSubZone(
          id: 'library',
          name: 'Main Library',
          latitude: 12.9716,
          longitude: 77.5946,
          radiusMeters: 60,
        ),
      );

      expect(withSubZone.subZones.single.name, 'Main Library');
      expect(
        () => service.addSubZone(
          institution: institution,
          adminUserId: 'visitor',
          subZone: withSubZone.subZones.single,
        ),
        throwsA(isA<InstitutionVerificationException>()),
      );
    });
  });
}
