import 'package:echoes/app/theme.dart';
import 'package:flutter/material.dart';

class PlaceCustodians extends StatelessWidget {
  const PlaceCustodians({required this.custodianIds, super.key});

  final List<String> custodianIds;

  @override
  Widget build(BuildContext context) {
    final sortedIds = [...custodianIds]..sort();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Custodians',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: EchoesColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        if (sortedIds.isEmpty)
          Text(
            'No custodians assigned yet.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: EchoesColors.textSecondary),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final custodianId in sortedIds)
                Chip(
                  avatar: const Icon(Icons.shield_outlined, size: 18),
                  label: Text(custodianId),
                  backgroundColor: EchoesColors.surface,
                  side: const BorderSide(color: EchoesColors.elevatedSurface),
                ),
            ],
          ),
      ],
    );
  }
}
