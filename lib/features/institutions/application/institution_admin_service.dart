import 'package:echoes/features/institutions/domain/campus_sub_zone.dart';
import 'package:echoes/features/institutions/domain/institution_zone.dart';

class InstitutionAdminService {
  const InstitutionAdminService();

  bool isAlumniEmail({
    required String email,
    required InstitutionZone institution,
  }) {
    final normalizedEmail = email.trim().toLowerCase();
    final emailParts = normalizedEmail.split('@');
    if (emailParts.length != 2) {
      return false;
    }
    final domain = emailParts.last;

    return institution.allowedEmailDomains.any(
      (allowedDomain) => domain == allowedDomain.trim().toLowerCase(),
    );
  }

  InstitutionZone verifyAdmin({
    required InstitutionZone institution,
    required String userId,
    required String email,
  }) {
    if (!isAlumniEmail(email: email, institution: institution)) {
      throw const InstitutionVerificationException(
        'Email domain is not approved for this institution.',
      );
    }
    if (institution.verifiedAdminUserIds.contains(userId)) {
      return institution;
    }

    return institution.copyWith(
      verifiedAdminUserIds: [...institution.verifiedAdminUserIds, userId],
    );
  }

  InstitutionZone addSubZone({
    required InstitutionZone institution,
    required String adminUserId,
    required CampusSubZone subZone,
  }) {
    if (!institution.verifiedAdminUserIds.contains(adminUserId)) {
      throw const InstitutionVerificationException(
        'Only verified institution admins can add sub-zones.',
      );
    }

    final subZones = [
      ...institution.subZones.where((current) => current.id != subZone.id),
      subZone,
    ];
    return institution.copyWith(subZones: subZones);
  }
}

class InstitutionVerificationException implements Exception {
  const InstitutionVerificationException(this.message);

  final String message;

  @override
  String toString() => message;
}
