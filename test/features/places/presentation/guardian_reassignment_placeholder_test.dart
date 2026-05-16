import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/presentation/guardian_reassignment_placeholder.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows guardian reassignment placeholder for custodians', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: GuardianReassignmentPlaceholder(
            place: _place(custodianIds: const ['custodian']),
            currentUserId: 'custodian',
          ),
        ),
      ),
    );

    expect(find.text('Guardian reassignment'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('guardianReassignmentPlaceholderButton')),
      findsOneWidget,
    );
  });

  testWidgets('hides guardian reassignment placeholder for non-custodians', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: GuardianReassignmentPlaceholder(
            place: _place(custodianIds: const ['custodian']),
            currentUserId: 'visitor',
          ),
        ),
      ),
    );

    expect(find.text('Guardian reassignment'), findsNothing);
  });
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
