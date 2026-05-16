import 'package:echoes/app/theme.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter/material.dart';

class MemoryCard extends StatelessWidget {
  const MemoryCard({required this.memory, this.onTap, super.key});

  final Memory memory;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    memory.privacy == PrivacyType.public
                        ? Icons.public
                        : Icons.lock_outline,
                    size: 18,
                    color: EchoesColors.sunsetGold,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    memory.privacy == PrivacyType.public ? 'Public' : 'Private',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: EchoesColors.sunsetGold,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    _formatDate(memory.createdAt),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
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
                      size: 16,
                      color: EchoesColors.textSecondary,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Created by ${memory.userId}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: EchoesColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 12),
              Text(
                memory.textContent,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: EchoesColors.textPrimary,
                  height: 1.35,
                ),
              ),
              if (memory.imageUrl != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Icon(
                      Icons.image_outlined,
                      size: 18,
                      color: EchoesColors.textSecondary,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        memory.imageUrl!,
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
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime dateTime) {
    final local = dateTime.toLocal();
    return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year}';
  }

  bool _showsCreator(Memory memory) {
    return memory.privacy == PrivacyType.public ||
        memory.privacy == PrivacyType.timeRelease;
  }
}
