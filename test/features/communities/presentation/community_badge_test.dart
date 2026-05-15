import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_type.dart';
import 'package:echoes/features/communities/presentation/community_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('CommunityBadge renders name and type icon', (tester) async {
    final now = DateTime.utc(2026, 5, 15);
    final community = Community(
      id: 'campus-keepers',
      name: 'Campus Keepers',
      description: 'Shared campus archive.',
      type: CommunityType.thematic,
      ownerId: 'user-1',
      memberCount: 12,
      createdAt: now,
      updatedAt: now,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: CommunityBadge(community: community)),
      ),
    );

    expect(find.text('Campus Keepers'), findsOneWidget);
    expect(find.byIcon(Icons.auto_awesome_outlined), findsOneWidget);
  });
}
