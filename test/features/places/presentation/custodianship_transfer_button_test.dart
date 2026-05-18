import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/legacy/application/custodianship_transfer_service.dart';
import 'package:echoes/features/legacy/data/local_legacy_transfer_repository.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer_repository.dart';
import 'package:echoes/features/notifications/data/local_notification_delivery_service.dart';
import 'package:echoes/features/places/data/local_place_repository.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/presentation/custodianship_transfer_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('hides transfer action for non-custodians', (tester) async {
    await tester.pumpWidget(
      _TestApp(
        repository: LocalLegacyTransferRepository(),
        child: CustodianshipTransferButton(
          place: _place(custodianIds: const ['custodian']),
          currentUserId: 'visitor',
        ),
      ),
    );

    expect(find.byKey(const ValueKey('initiateTransferButton')), findsNothing);
  });

  testWidgets('creates a pending transfer for custodians', (tester) async {
    final repository = LocalLegacyTransferRepository();
    final notifications = LocalNotificationDeliveryService();

    await tester.pumpWidget(
      _TestApp(
        repository: repository,
        notifications: notifications,
        child: CustodianshipTransferButton(
          place: _place(custodianIds: const ['custodian']),
          currentUserId: 'custodian',
        ),
      ),
    );

    await tester.tap(find.byKey(const ValueKey('initiateTransferButton')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('transferRecipientField')),
      'recipient',
    );
    await tester.tap(find.byKey(const ValueKey('sendTransferButton')));
    await tester.pumpAndSettle();

    final transfer = repository.transferHistory().single;
    expect(transfer.placeId, 'place-1');
    expect(transfer.fromUserId, 'custodian');
    expect(transfer.toUserId, 'recipient');
    expect(notifications.deliveries.single.recipientUserId, 'recipient');
  });
}

class _TestApp extends StatelessWidget {
  const _TestApp({
    required this.repository,
    required this.child,
    this.notifications,
  });

  final LegacyTransferRepository repository;
  final LocalNotificationDeliveryService? notifications;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final notificationDeliveryService =
        notifications ?? LocalNotificationDeliveryService();
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<LegacyTransferRepository>.value(value: repository),
        RepositoryProvider<CustodianshipTransferService>(
          create: (_) => CustodianshipTransferService(
            transferRepository: repository,
            placeRepository: LocalPlaceRepository(),
            notificationDeliveryService: notificationDeliveryService,
          ),
        ),
      ],
      child: MaterialApp(
        home: Scaffold(body: Center(child: child)),
      ),
    );
  }
}

Place _place({required List<String> custodianIds}) {
  final now = DateTime.utc(2026, 5, 16);
  return Place(
    id: 'place-1',
    name: 'Old Courtyard',
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: 'tdr1v',
    custodianIds: custodianIds,
    aura: AuraZone.empty(now),
    memoryCount: 1,
    publicMemoryCount: 1,
    createdAt: now,
    updatedAt: now,
  );
}
