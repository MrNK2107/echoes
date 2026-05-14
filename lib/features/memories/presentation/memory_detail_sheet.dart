import 'package:echoes/app/theme.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter/material.dart';

class MemoryDetailSheet extends StatelessWidget {
  const MemoryDetailSheet({required this.memory, super.key});

  final Memory memory;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                memory.privacy == PrivacyType.public
                    ? Icons.public
                    : Icons.lock_outline,
                color: EchoesColors.sunsetGold,
              ),
              const SizedBox(width: 8),
              Text(
                memory.privacy == PrivacyType.public ? 'Public' : 'Private',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: EchoesColors.sunsetGold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            memory.textContent,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: EchoesColors.textPrimary,
              height: 1.45,
            ),
          ),
          if (memory.imageUrl != null) ...[
            const SizedBox(height: 16),
            Text(
              'Photo: ${memory.imageUrl}',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: EchoesColors.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: 16),
          Text(
            'Location: ${memory.latitude.toStringAsFixed(4)}, ${memory.longitude.toStringAsFixed(4)}',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: EchoesColors.textSecondary),
          ),
        ],
      ),
    );
  }
}
