import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:echoes/features/places/data/place_dto.dart';
import 'package:echoes/features/places/domain/nearby_place_query.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';

class FirestorePlaceRepository implements PlaceRepository {
  FirestorePlaceRepository({
    FirebaseFirestore? firestore,
    this.nearbyCandidateLimit = defaultNearbyCandidateLimit,
  }) : _firestore = firestore ?? FirebaseFirestore.instance;

  static const defaultNearbyCandidateLimit = 100;

  final FirebaseFirestore _firestore;
  final int nearbyCandidateLimit;

  CollectionReference<Map<String, dynamic>> get _collection =>
      _firestore.collection('places');

  @override
  Future<void> create(Place place) {
    return _collection.doc(place.id).set(PlaceDto.fromDomain(place).toMap());
  }

  @override
  Future<Place?> findById(String id) async {
    final snapshot = await _collection.doc(id).get();
    final data = snapshot.data();
    return data == null ? null : PlaceDto.fromMap(snapshot.id, data).toDomain();
  }

  @override
  Future<Place?> findNearestPlace({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) async {
    final prefixes = NearbyPlaceQuery.queryPrefixes(
      latitude: latitude,
      longitude: longitude,
      radiusMeters: radiusMeters,
    );
    final matches = <({Place place, double distance})>[];

    for (final prefix in prefixes) {
      final snapshot = await _collection
          .where('geohash', isGreaterThanOrEqualTo: prefix)
          .where('geohash', isLessThan: '${prefix}z')
          .limit(nearbyCandidateLimit)
          .get();

      for (final doc in snapshot.docs) {
        final place = PlaceDto.fromMap(doc.id, doc.data()).toDomain();
        final distance = _distanceMeters(
          latitude,
          longitude,
          place.latitude,
          place.longitude,
        );
        if (distance <= radiusMeters) {
          matches.add((place: place, distance: distance));
        }
      }
    }

    matches.sort((a, b) => a.distance.compareTo(b.distance));
    return matches.firstOrNull?.place;
  }

  @override
  Future<void> save(Place place) {
    return _collection.doc(place.id).set(PlaceDto.fromDomain(place).toMap());
  }

  @override
  Future<void> addCustodian({
    required String placeId,
    required String userId,
    required DateTime updatedAt,
  }) async {
    await _collection.doc(placeId).update({
      'custodianIds': FieldValue.arrayUnion([userId]),
      'updatedAt': updatedAt.toIso8601String(),
    });
  }

  @override
  Future<void> removeCustodian({
    required String placeId,
    required String userId,
    required DateTime updatedAt,
  }) async {
    await _collection.doc(placeId).update({
      'custodianIds': FieldValue.arrayRemove([userId]),
      'updatedAt': updatedAt.toIso8601String(),
    });
  }

  @override
  Stream<List<Place>> watchNearbyPlaces({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) {
    final prefixes = NearbyPlaceQuery.queryPrefixes(
      latitude: latitude,
      longitude: longitude,
      radiusMeters: radiusMeters,
    );

    // Use the first prefix for the realtime stream since multiple geohash
    // range streams cannot be merged efficiently. The first prefix covers
    // the majority of nearby candidates; edge places across cell boundaries
    // may be missed on each individual snapshot but will be picked up when
    // the user re-centers.
    final primaryPrefix = prefixes.first;

    return _collection
        .where('geohash', isGreaterThanOrEqualTo: primaryPrefix)
        .where('geohash', isLessThan: '${primaryPrefix}z')
        .limit(nearbyCandidateLimit)
        .snapshots()
        .map((snapshot) {
          return snapshot.docs
              .map((doc) => PlaceDto.fromMap(doc.id, doc.data()).toDomain())
              .where(
                (place) =>
                    _distanceMeters(
                      latitude,
                      longitude,
                      place.latitude,
                      place.longitude,
                    ) <=
                    radiusMeters,
              )
              .toList();
        });
  }

  static double _distanceMeters(
    double startLatitude,
    double startLongitude,
    double endLatitude,
    double endLongitude,
  ) {
    const earthRadiusMeters = 6371000;
    final dLat = _degreesToRadians(endLatitude - startLatitude);
    final dLon = _degreesToRadians(endLongitude - startLongitude);
    final lat1 = _degreesToRadians(startLatitude);
    final lat2 = _degreesToRadians(endLatitude);

    final a =
        sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadiusMeters * c;
  }

  static double _degreesToRadians(double degrees) => degrees * pi / 180;
}
