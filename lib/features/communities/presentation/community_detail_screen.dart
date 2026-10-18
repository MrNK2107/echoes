import 'package:echoes/app/theme.dart';
import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/communities/domain/community_role.dart';
import 'package:echoes/features/communities/presentation/community_badge.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/memory_card.dart';
import 'package:echoes/features/memories/presentation/memory_detail_sheet.dart';
import 'package:echoes/shared/widgets/empty_state.dart';
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
            // Header section
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

            // Join button
            _JoinButton(
              communityId: community.id,
              userId: userId,
            ),
            const SizedBox(height: 24),

            // Community memory feed
            Text(
              'Community feed',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _CommunityFeed(communityId: community.id),
            ),
          ],
        ),
      ),
    );
  }
}

class _JoinButton extends StatefulWidget {
  const _JoinButton({required this.communityId, required this.userId});

  final String communityId;
  final String userId;

  @override
  State<_JoinButton> createState() => _JoinButtonState();
}

class _JoinButtonState extends State<_JoinButton> {
  late Future<dynamic> _membershipFuture;

  @override
  void initState() {
    super.initState();
    _membershipFuture = context
        .read<CommunityRepository>()
        .findMembership(
          communityId: widget.communityId,
          userId: widget.userId,
        );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<dynamic>(
      future: _membershipFuture,
      builder: (context, snapshot) {
        final isMember = snapshot.hasData && snapshot.data != null;

        return OutlinedButton.icon(
          key: const ValueKey('joinCommunityButton'),
          onPressed: isMember
              ? null
              : () async {
                  await context.read<CommunityRepository>().join(
                    communityId: widget.communityId,
                    userId: widget.userId,
                    role: CommunityRole.member,
                  );
                  if (mounted) {
                    setState(() {
                      _membershipFuture = context
                          .read<CommunityRepository>()
                          .findMembership(
                            communityId: widget.communityId,
                            userId: widget.userId,
                          );
                    });
                  }
                },
          icon: Icon(
            isMember ? Icons.check : Icons.person_add_alt_1,
          ),
          label: Text(isMember ? 'Member' : 'Join community'),
        );
      },
    );
  }
}

class _CommunityFeed extends StatelessWidget {
  const _CommunityFeed({required this.communityId});

  final String communityId;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Memory>>(
      stream: context
          .read<MemoryRepository>()
          .watchCommunityMemories(communityId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(strokeWidth: 2));
        }

        final memories = snapshot.data ?? const <Memory>[];
        if (memories.isEmpty) {
          return const EmptyState(
            icon: Icons.auto_stories_outlined,
            title: 'No community memories yet.',
            description:
                'Memories shared with this community will appear here.\n'
                'Add a memory and select this community as its privacy scope.',
          );
        }

        return ListView.separated(
          itemCount: memories.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final memory = memories[index];
            return MemoryCard(
              memory: memory,
              onTap: () => showModalBottomSheet<void>(
                context: context,
                showDragHandle: true,
                builder: (_) => MemoryDetailSheet(memory: memory),
              ),
            );
          },
        );
      },
    );
  }
}
