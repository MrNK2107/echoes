import 'package:echoes/features/auth/data/local_auth_repository.dart';
import 'package:echoes/features/auth/domain/auth_repository.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/communities/data/local_community_repository.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/communities/presentation/communities_placeholder_screen.dart';
import 'package:echoes/features/users/data/local_app_user_repository.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('creates a thematic community from the sheet', (tester) async {
    final authRepository = LocalAuthRepository();
    final userRepository = LocalAppUserRepository();
    final communityRepository = LocalCommunityRepository(
      now: DateTime.utc(2026, 5, 15),
    );

    await tester.pumpWidget(
      _TestApp(
        authRepository: authRepository,
        userRepository: userRepository,
        communityRepository: communityRepository,
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
  });

  final AuthRepository authRepository;
  final AppUserRepository userRepository;
  final CommunityRepository communityRepository;

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<AuthRepository>.value(value: authRepository),
        RepositoryProvider<AppUserRepository>.value(value: userRepository),
        RepositoryProvider<CommunityRepository>.value(
          value: communityRepository,
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
