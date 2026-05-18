import 'dart:async';

import 'package:echoes/features/auth/data/local_auth_repository.dart';
import 'package:echoes/features/auth/domain/auth_repository.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/communities/data/local_community_repository.dart';
import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_membership.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/communities/domain/community_role.dart';
import 'package:echoes/features/communities/presentation/communities_placeholder_screen.dart';
import 'package:echoes/features/notifications/data/local_notification_delivery_service.dart';
import 'package:echoes/features/notifications/domain/notification_delivery.dart';
import 'package:echoes/features/notifications/domain/notification_delivery_service.dart';
import 'package:echoes/features/users/data/local_app_user_repository.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders placeholders for future community modes', (
    tester,
  ) async {
    final authRepository = LocalAuthRepository();
    final userRepository = LocalAppUserRepository();
    final communityRepository = LocalCommunityRepository(
      now: DateTime.utc(2026, 5, 15),
    );
    final notifications = LocalNotificationDeliveryService();

    await tester.pumpWidget(
      _TestApp(
        authRepository: authRepository,
        userRepository: userRepository,
        communityRepository: communityRepository,
        notificationDeliveryService: notifications,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Geographic'), findsOneWidget);
    expect(find.text('Time-based'), findsOneWidget);
    expect(find.text('Institution'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    authRepository.dispose();
    userRepository.dispose();
    communityRepository.dispose();
  });

  testWidgets('creates a thematic community from the sheet', (tester) async {
    final authRepository = LocalAuthRepository();
    final userRepository = LocalAppUserRepository();
    final communityRepository = LocalCommunityRepository(
      now: DateTime.utc(2026, 5, 15),
    );
    final notifications = LocalNotificationDeliveryService();

    await tester.pumpWidget(
      _TestApp(
        authRepository: authRepository,
        userRepository: userRepository,
        communityRepository: communityRepository,
        notificationDeliveryService: notifications,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('createCommunityButton')));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('communityNameField')),
      'Library Nights',
    );
    await tester.enterText(
      find.byKey(const ValueKey('communityDescriptionField')),
      'Late study memories from the old library.',
    );
    await tester.enterText(
      find.byKey(const ValueKey('communityInviteesField')),
      'friend-1, friend-2, user-1',
    );
    await tester.tap(find.byKey(const ValueKey('saveCommunityButton')));
    await tester.pumpAndSettle();

    expect(find.text('Library Nights'), findsWidgets);
    expect(
      find.text('Late study memories from the old library.'),
      findsOneWidget,
    );

    final created = await communityRepository
        .watchUserCommunities('user-1')
        .first;
    expect(
      created.map((community) => community.name),
      contains('Library Nights'),
    );
    expect(
      notifications.deliveries.map((delivery) => delivery.recipientUserId),
      ['friend-1', 'friend-2'],
    );
    expect(notifications.deliveries.map((delivery) => delivery.type).toSet(), {
      NotificationDeliveryType.communityInvitation,
    });

    await tester.pumpWidget(const SizedBox.shrink());
    authRepository.dispose();
    userRepository.dispose();
    communityRepository.dispose();
  });

  testWidgets('renders loading state while communities load', (tester) async {
    final authRepository = LocalAuthRepository();
    final userRepository = LocalAppUserRepository();
    final communityRepository = _LoadingCommunityRepository();

    await tester.pumpWidget(
      _TestApp(
        authRepository: authRepository,
        userRepository: userRepository,
        communityRepository: communityRepository,
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Loading communities'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    authRepository.dispose();
    userRepository.dispose();
    communityRepository.dispose();
  });
}

class _TestApp extends StatelessWidget {
  const _TestApp({
    required this.authRepository,
    required this.userRepository,
    required this.communityRepository,
    this.notificationDeliveryService,
  });

  final AuthRepository authRepository;
  final AppUserRepository userRepository;
  final CommunityRepository communityRepository;
  final NotificationDeliveryService? notificationDeliveryService;

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<AuthRepository>.value(value: authRepository),
        RepositoryProvider<AppUserRepository>.value(value: userRepository),
        RepositoryProvider<CommunityRepository>.value(
          value: communityRepository,
        ),
        RepositoryProvider<NotificationDeliveryService>.value(
          value:
              notificationDeliveryService ?? LocalNotificationDeliveryService(),
        ),
      ],
      child: BlocProvider(
        create: (context) =>
            AuthCubit(
                repository: context.read<AuthRepository>(),
                userRepository: context.read<AppUserRepository>(),
              )
              ..start()
              ..signIn(email: 'user-1', password: 'password123'),
        child: const MaterialApp(
          home: Scaffold(body: CommunitiesPlaceholderScreen()),
        ),
      ),
    );
  }
}

class _LoadingCommunityRepository implements CommunityRepository {
  final _controller = StreamController<List<Community>>();

  void dispose() {
    _controller.close();
  }

  @override
  Future<void> create(Community community) async {}

  @override
  Future<Community?> findById(String id) async => null;

  @override
  Future<CommunityMembership?> findMembership({
    required String communityId,
    required String userId,
  }) async {
    return null;
  }

  @override
  Future<void> join({
    required String communityId,
    required String userId,
    required CommunityRole role,
  }) async {}

  @override
  Stream<List<Community>> watchCommunities() {
    return _controller.stream;
  }

  @override
  Stream<List<Community>> watchUserCommunities(String userId) {
    return const Stream.empty();
  }
}
