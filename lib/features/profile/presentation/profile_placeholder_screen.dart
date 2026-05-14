import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:echoes/app/theme.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/auth/presentation/auth_state.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer_repository.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/edit_memory_sheet.dart';
import 'package:echoes/features/memories/presentation/memory_card.dart';
import 'package:echoes/features/memories/presentation/memory_detail_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class ProfilePlaceholderScreen extends StatelessWidget {
  const ProfilePlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, state) {
        final session = state.session;

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (session == null)
                  const Expanded(
                    child: FeaturePlaceholder(
                      icon: Icons.account_circle_outlined,
                      title: 'Custodianship starts here.',
                      description:
                          'Profiles will show created memories, managed places, legacy transfers, and privacy defaults.',
                      nextStep:
                          'Next: implement Firebase Auth and create user profile documents after signup.',
                    ),
                  )
                else ...[
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: EchoesColors.celestialBlue.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.account_circle_outlined,
                      color: EchoesColors.celestialBlue,
                      size: 34,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    session.displayName ?? 'Echoes custodian',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: EchoesColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    session.email,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: EchoesColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 24),
                  _ProfileStatRow(userId: session.userId),
                  const SizedBox(height: 24),
                  _PendingTransfers(userId: session.userId),
                  const SizedBox(height: 24),
                  Text(
                    'Your memories',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: EchoesColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Expanded(child: _UserMemoryList(userId: session.userId)),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    key: const ValueKey('signOutButton'),
                    onPressed: () => context.read<AuthCubit>().signOut(),
                    icon: const Icon(Icons.logout),
                    label: const Text('Sign out'),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _PendingTransfers extends StatelessWidget {
  const _PendingTransfers({required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<LegacyTransfer>>(
      stream: context
          .read<LegacyTransferRepository>()
          .watchPendingTransfersForUser(userId),
      builder: (context, snapshot) {
        final transfers = snapshot.data ?? const <LegacyTransfer>[];
        if (transfers.isEmpty) {
          return const SizedBox.shrink();
        }

        final transfer = transfers.first;
        return DecoratedBox(
          decoration: BoxDecoration(
            color: EchoesColors.surface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: EchoesColors.elevatedSurface),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Pending custodianship',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: EchoesColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Place transfer from ${transfer.fromUserId}',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: EchoesColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const ValueKey('acceptTransferButton'),
                        onPressed: () => context
                            .read<LegacyTransferRepository>()
                            .accept(transfer.id),
                        icon: const Icon(Icons.check),
                        label: const Text('Accept'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const ValueKey('rejectTransferButton'),
                        onPressed: () => context
                            .read<LegacyTransferRepository>()
                            .reject(transfer.id),
                        icon: const Icon(Icons.close),
                        label: const Text('Reject'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ProfileStatRow extends StatelessWidget {
  const _ProfileStatRow({required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Memory>>(
      stream: context.read<MemoryRepository>().watchMemoriesForUser(userId),
      builder: (context, snapshot) {
        final memories = snapshot.data ?? const <Memory>[];

        return Row(
          children: [
            Expanded(
              child: _ProfileStat(
                label: 'Memories',
                value: '${memories.length}',
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: _ProfileStat(label: 'Places', value: '0'),
            ),
          ],
        );
      },
    );
  }
}

class _ProfileStat extends StatelessWidget {
  const _ProfileStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: EchoesColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EchoesColors.elevatedSurface),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
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

class _UserMemoryList extends StatelessWidget {
  const _UserMemoryList({required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Memory>>(
      stream: context.read<MemoryRepository>().watchMemoriesForUser(userId),
      builder: (context, snapshot) {
        final memories = snapshot.data ?? const <Memory>[];

        if (memories.isEmpty) {
          return Text(
            'No memories yet.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: EchoesColors.textSecondary),
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
                builder: (_) => MemoryDetailSheet(
                  memory: memory,
                  onEdit: () {
                    Navigator.of(context).pop();
                    showModalBottomSheet<void>(
                      context: context,
                      isScrollControlled: true,
                      showDragHandle: true,
                      builder: (_) => EditMemorySheet(memory: memory),
                    );
                  },
                  onDelete: () async {
                    Navigator.of(context).pop();
                    await context.read<MemoryRepository>().softDelete(
                      memoryId: memory.id,
                      deletedAt: DateTime.now().toUtc(),
                    );
                  },
                ),
              ),
            );
          },
        );
      },
    );
  }
}
