import 'package:echoes/app/theme.dart';
import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/communities/domain/community_role.dart';
import 'package:echoes/features/communities/presentation/community_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class CommunityDetailScreen extends StatelessWidget {
  const CommunityDetailScreen({
    required this.community,
    required this.userId,
    super.key,
  });

  final Community community;
  final String userId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(community.name)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              community.description,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: EchoesColors.textSecondary,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '${community.memberCount} members',
              style: Theme.of(
                context,
              ).textTheme.labelLarge?.copyWith(color: EchoesColors.sunsetGold),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: CommunityBadge(community: community),
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              key: const ValueKey('joinCommunityButton'),
              onPressed: () async {
                await context.read<CommunityRepository>().join(
                  communityId: community.id,
                  userId: userId,
                  role: CommunityRole.member,
                );
              },
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text('Join community'),
            ),
            const SizedBox(height: 24),
            Text(
              'Community feed',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Community-scoped memories will appear here as the archive grows.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: EchoesColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
