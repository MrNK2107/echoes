import 'package:echoes/app/theme.dart';
import 'package:echoes/features/aura/presentation/aura_preview.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/memory_card.dart';
import 'package:echoes/features/memories/presentation/memory_detail_sheet.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/presentation/custodianship_transfer_button.dart';
import 'package:echoes/features/places/presentation/guardian_reassignment_placeholder.dart';
import 'package:echoes/features/places/presentation/place_custodians.dart';
import 'package:echoes/shared/widgets/loading_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class PlaceDetailSheet extends StatelessWidget {
  const PlaceDetailSheet({required this.place, this.currentUserId, super.key});

  final Place place;
  final String? currentUserId;

  @override
  Widget build(BuildContext context) {
    final memoryRepository = context.read<MemoryRepository>();

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            place.name,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: EchoesColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${place.memoryCount} memories',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: EchoesColors.textSecondary),
          ),
          const SizedBox(height: 16),
          AuraPreview(aura: place.aura),
          const SizedBox(height: 16),
          PlaceCustodians(custodianIds: place.custodianIds),
          if (currentUserId != null) ...[
            const SizedBox(height: 12),
            CustodianshipTransferButton(
              place: place,
              currentUserId: currentUserId!,
            ),
            const SizedBox(height: 12),
            GuardianReassignmentPlaceholder(
              place: place,
              currentUserId: currentUserId!,
            ),
          ],
          const SizedBox(height: 16),
          Text(
            'Memories',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: EchoesColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          StreamBuilder<List<Memory>>(
            stream: memoryRepository.watchMemoriesForPlace(place.id),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const LoadingState(label: 'Loading place memories');
              }

              final memories = snapshot.data ?? const <Memory>[];

              if (memories.isEmpty) {
                return Text(
                  'No memories saved here yet.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: EchoesColors.textSecondary,
                  ),
                );
              }

              return ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 260),
                child: ListView.separated(
                  shrinkWrap: true,
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
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
