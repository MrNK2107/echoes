import 'package:echoes/features/places/data/firestore_place_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('FirestorePlaceRepository bounds nearby candidate scans by default', () {
    expect(FirestorePlaceRepository.defaultNearbyCandidateLimit, 100);
  });
}
