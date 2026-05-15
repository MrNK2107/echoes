import 'package:echoes/app/theme.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/communities/domain/community_role.dart';
import 'package:echoes/features/communities/domain/community_type.dart';
import 'package:echoes/features/communities/presentation/community_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';

class CommunitiesPlaceholderScreen extends StatelessWidget {
  const CommunitiesPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthCubit>().state.session;
    if (session == null) {
      return const SizedBox.shrink();
    }

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Communities',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: EchoesColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton.filledTonal(
                  key: const ValueKey('createCommunityButton'),
                  onPressed: () => showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    showDragHandle: true,
                    builder: (_) =>
                        _CreateCommunitySheet(userId: session.userId),
                  ),
                  icon: const Icon(Icons.add),
                  tooltip: 'Create community',
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Shared archives for places, themes, eras, and institutions.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: EchoesColors.textSecondary,
              ),
            ),
            const SizedBox(height: 24),
            Expanded(child: _CommunityList(userId: session.userId)),
          ],
        ),
      ),
    );
  }
}

class _CommunityList extends StatelessWidget {
  const _CommunityList({required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Community>>(
      stream: context.read<CommunityRepository>().watchCommunities(),
      builder: (context, snapshot) {
        final communities = snapshot.data ?? const <Community>[];

        if (communities.isEmpty) {
          return Text(
            'No communities yet.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: EchoesColors.textSecondary),
          );
        }

        return ListView.separated(
          itemCount: communities.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final community = communities[index];
            return _CommunityCard(community: community, userId: userId);
          },
        );
      },
    );
  }
}

class _CommunityCard extends StatelessWidget {
  const _CommunityCard({required this.community, required this.userId});

  final Community community;
  final String userId;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: const Icon(Icons.groups_outlined),
        title: Text(community.name),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 6),
            CommunityBadge(community: community),
            const SizedBox(height: 8),
            Text(community.description),
          ],
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) =>
                _CommunityDetailScreen(community: community, userId: userId),
          ),
        ),
      ),
    );
  }
}

class _CommunityDetailScreen extends StatelessWidget {
  const _CommunityDetailScreen({required this.community, required this.userId});

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

class _CreateCommunitySheet extends StatefulWidget {
  const _CreateCommunitySheet({required this.userId});

  final String userId;

  @override
  State<_CreateCommunitySheet> createState() => _CreateCommunitySheetState();
}

class _CreateCommunitySheetState extends State<_CreateCommunitySheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Create community',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            TextFormField(
              key: const ValueKey('communityNameField'),
              controller: _nameController,
              validator: (value) =>
                  (value?.trim() ?? '').isEmpty ? 'Name is required' : null,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const ValueKey('communityDescriptionField'),
              controller: _descriptionController,
              minLines: 3,
              maxLines: 4,
              validator: (value) => (value?.trim() ?? '').isEmpty
                  ? 'Description is required'
                  : null,
              decoration: const InputDecoration(labelText: 'Description'),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              key: const ValueKey('saveCommunityButton'),
              onPressed: _save,
              icon: const Icon(Icons.save_outlined),
              label: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final now = DateTime.now().toUtc();
    final community = Community(
      id: const Uuid().v4(),
      name: _nameController.text.trim(),
      description: _descriptionController.text.trim(),
      type: CommunityType.thematic,
      ownerId: widget.userId,
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    );

    await context.read<CommunityRepository>().create(community);

    if (mounted) {
      Navigator.of(context).pop();
    }
  }
}
