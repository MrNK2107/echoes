import 'package:echoes/features/communities/data/local_community_repository.dart';
import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/communities/domain/community_role.dart';
import 'package:echoes/features/communities/domain/community_type.dart';
import 'package:echoes/features/communities/presentation/community_detail_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('CommunityDetailScreen renders detail and joins community', (
    tester,
  ) async {
    final repository = LocalCommunityRepository(now: DateTime.utc(2026, 5, 17));
    final community = _community();
    await repository.create(community);

    await tester.pumpWidget(
      _TestApp(
        repository: repository,
        child: CommunityDetailScreen(community: community, userId: 'user-2'),
      ),
    );

    expect(find.text('Library Nights'), findsWidgets);
    expect(
      find.text('Late study memories from the old library.'),
      findsOneWidget,
    );
    expect(find.text('3 members'), findsOneWidget);
    expect(find.text('Community feed'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('joinCommunityButton')));
    await tester.pumpAndSettle();

    final membership = await repository.findMembership(
      communityId: community.id,
      userId: 'user-2',
    );
    expect(membership?.role, CommunityRole.member);

    repository.dispose();
  });
}

class _TestApp extends StatelessWidget {
  const _TestApp({required this.repository, required this.child});

  final CommunityRepository repository;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RepositoryProvider<CommunityRepository>.value(
      value: repository,
      child: MaterialApp(home: child),
    );
  }
}

Community _community() {
  final now = DateTime.utc(2026, 5, 17);
  return Community(
    id: 'community-1',
    name: 'Library Nights',
    description: 'Late study memories from the old library.',
    type: CommunityType.thematic,
    ownerId: 'user-1',
    memberCount: 3,
    createdAt: now,
    updatedAt: now,
  );
}
