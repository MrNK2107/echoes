import 'package:echoes/app/theme.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:flutter/material.dart';

class GuardianReassignmentPlaceholder extends StatelessWidget {
  const GuardianReassignmentPlaceholder({
    required this.place,
    required this.currentUserId,
    super.key,
  });

  final Place place;
  final String currentUserId;

  @override
  Widget build(BuildContext context) {
    if (!place.custodianIds.contains(currentUserId)) {
      return const SizedBox.shrink();
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: EchoesColors.elevatedSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EchoesColors.surface),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.admin_panel_settings_outlined),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Guardian reassignment',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: EchoesColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            TextButton(
              key: const ValueKey('guardianReassignmentPlaceholderButton'),
              onPressed: null,
              child: const Text('Queued'),
            ),
          ],
        ),
      ),
    );
  }
}
