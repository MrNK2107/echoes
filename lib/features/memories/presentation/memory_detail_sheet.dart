import 'package:echoes/app/theme.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter/material.dart';

class MemoryDetailSheet extends StatelessWidget {
  const MemoryDetailSheet({
    required this.memory,
    this.onEdit,
    this.onDelete,
    super.key,
  });

  final Memory memory;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

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
          Row(
            children: [
              const Icon(
                Icons.schedule,
                size: 18,
                color: EchoesColors.textSecondary,
              ),
              const SizedBox(width: 8),
              Text(
                'Created ${_formatTimestamp(memory.createdAt)}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: EchoesColors.textSecondary,
                ),
              ),
            ],
          ),
          if (_showsCreator(memory)) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(
                  Icons.person_outline,
                  size: 18,
                  color: EchoesColors.textSecondary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Created by ${memory.userId}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: EchoesColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ],
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
          if (onEdit != null || onDelete != null) ...[
            const SizedBox(height: 20),
            Row(
              children: [
                if (onEdit != null)
                  Expanded(
                    child: OutlinedButton.icon(
                      key: const ValueKey('editMemoryButton'),
                      onPressed: onEdit,
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Edit'),
                    ),
                  ),
                if (onEdit != null && onDelete != null)
                  const SizedBox(width: 12),
                if (onDelete != null)
                  Expanded(
                    child: OutlinedButton.icon(
                      key: const ValueKey('deleteMemoryButton'),
                      onPressed: onDelete,
                      icon: const Icon(Icons.delete_outline),
                      label: const Text('Delete'),
                    ),
                  ),
              ],
            ),
            if (onDelete != null) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                key: const ValueKey('restoreMemoryPlaceholderButton'),
                onPressed: null,
                icon: const Icon(Icons.restore_outlined),
                label: const Text('30-day restore coming soon'),
              ),
            ],
          ],
        ],
      ),
    );
  }

  String _formatTimestamp(DateTime dateTime) {
    final local = dateTime.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$day/$month/${local.year} $hour:$minute';
  }

  bool _showsCreator(Memory memory) {
    return memory.privacy == PrivacyType.public ||
        memory.privacy == PrivacyType.timeRelease;
  }
}
