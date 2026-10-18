import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:echoes/features/places/presentation/guardian_reassignment_placeholder.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:echoes/features/users/domain/app_user.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows custodians list for custodians', (tester) async {
    await tester.pumpWidget(
      _TestApp(
        child: GuardianReassignment(
          place: _place(custodianIds: ['custodian']),
          currentUserId: 'custodian',
        ),
      ),
    );

    expect(find.text('Custodians'), findsOneWidget);
    expect(find.text('custodian (you)'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('hides custodian management for non-custodians', (tester) async {
    await tester.pumpWidget(
      _TestApp(
        child: GuardianReassignment(
          place: _place(custodianIds: ['custodian']),
          currentUserId: 'visitor',
        ),
      ),
    );

    expect(find.text('Custodians'), findsNothing);
  });
}

class _FakeAppUserRepository implements AppUserRepository {
  @override
  Future<void> create(AppUser user) async {}

  @override
  Future<void> delete(String id) async {}

  @override
  Future<AppUser?> findById(String id) async => null;

  @override
  Future<List<AppUser>> searchUsers(String query, {int limit = 10}) async {
    return const [];
  }

  @override
  Future<void> setCurrentUserId(String? userId) async {}

  @override
  Future<void> updateDefaultPrivacy(PrivacyType privacy) async {}

  @override
  Stream<AppUser?> watchCurrentUser() => Stream.value(null);
}

class _FakePlaceRepository implements PlaceRepository {
  @override
  Future<void> create(Place place) async {}

  @override
  Future<Place?> findById(String id) async => null;

  @override
  Future<Place?> findNearestPlace({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) async => null;

  @override
  Future<void> save(Place place) async {}

  @override
  Future<void> addCustodian({
    required String placeId,
    required String userId,
    required DateTime updatedAt,
  }) async {}

  @override
  Future<void> removeCustodian({
    required String placeId,
    required String userId,
    required DateTime updatedAt,
  }) async {}

  @override
  Stream<List<Place>> watchNearbyPlaces({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) => Stream.value(const []);
}

class _TestApp extends StatelessWidget {
  const _TestApp({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<AppUserRepository>(
          create: (_) => _FakeAppUserRepository(),
        ),
        RepositoryProvider<PlaceRepository>(
          create: (_) => _FakePlaceRepository(),
        ),
      ],
      child: MaterialApp(home: Scaffold(body: child)),
    );
  }
}

Place _place({required List<String> custodianIds}) {
  final now = DateTime.utc(2026, 5, 16);
  return Place(
    id: 'place-1',
    name: 'Assembly Hall',
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: 'tdr1',
    custodianIds: custodianIds,
    aura: AuraZone.empty(now),
    memoryCount: 1,
    publicMemoryCount: 1,
    createdAt: now,
    updatedAt: now,
  );
}
