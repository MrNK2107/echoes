import 'dart:async';

import 'package:echoes/features/institutions/domain/institution_repository.dart';
import 'package:echoes/features/institutions/domain/institution_zone.dart';

class LocalInstitutionRepository implements InstitutionRepository {
  final Map<String, InstitutionZone> _zones = {};
  final _controller = StreamController<List<InstitutionZone>>.broadcast();

  @override
  Future<void> create(InstitutionZone zone) async {
    _zones[zone.id] = zone;
    _emit();
  }

  @override
  Future<InstitutionZone?> findById(String id) async {
    return _zones[id];
  }

  @override
  Future<void> save(InstitutionZone zone) async {
    _zones[zone.id] = zone;
    _emit();
  }

  @override
  Stream<List<InstitutionZone>> watchInstitutions() async* {
    yield _zones.values.toList();
    yield* _controller.stream;
  }

  void _emit() {
    _controller.add(_zones.values.toList());
  }

  void dispose() {
    _controller.close();
  }
}
