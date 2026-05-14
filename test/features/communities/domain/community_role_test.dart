import 'package:echoes/features/communities/domain/community_role.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CommunityRole', () {
    test('owner and guardian can moderate', () {
      expect(CommunityRole.owner.canModerate, isTrue);
      expect(CommunityRole.guardian.canModerate, isTrue);
    });

    test('member and visitor cannot moderate', () {
      expect(CommunityRole.member.canModerate, isFalse);
      expect(CommunityRole.visitor.canModerate, isFalse);
    });

    test('visitor cannot add memories', () {
      expect(CommunityRole.owner.canAddMemories, isTrue);
      expect(CommunityRole.guardian.canAddMemories, isTrue);
      expect(CommunityRole.member.canAddMemories, isTrue);
      expect(CommunityRole.visitor.canAddMemories, isFalse);
    });
  });
}
