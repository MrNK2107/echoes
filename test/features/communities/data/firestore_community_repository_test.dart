import 'package:echoes/features/communities/data/firestore_community_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('FirestoreCommunityRepository bounds list streams by default', () {
    expect(FirestoreCommunityRepository.defaultCommunityLimit, 50);
    expect(FirestoreCommunityRepository.defaultUserMembershipLimit, 50);
  });
}
