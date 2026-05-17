import 'package:echoes/app/theme.dart';
import 'package:echoes/core/cache/app_cache_registry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class CacheManagementSettings extends StatefulWidget {
  const CacheManagementSettings({super.key});

  @override
  State<CacheManagementSettings> createState() =>
      _CacheManagementSettingsState();
}

class _CacheManagementSettingsState extends State<CacheManagementSettings> {
  int? _clearedCount;

  @override
  Widget build(BuildContext context) {
    final registry = context.read<AppCacheRegistry>();
    final cachedItemCount = registry.cachedItemCount;

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
            Row(
              children: [
                const Icon(
                  Icons.cached_outlined,
                  color: EchoesColors.celestialBlue,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Cached data',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: EchoesColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Text(
                  '$cachedItemCount',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: EchoesColors.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            if (_clearedCount != null) ...[
              const SizedBox(height: 8),
              Text(
                'Cleared $_clearedCount cached item(s).',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: EchoesColors.textSecondary,
                ),
              ),
            ],
            const SizedBox(height: 12),
            OutlinedButton.icon(
              key: const ValueKey('clearCacheButton'),
              onPressed: cachedItemCount == 0
                  ? null
                  : () {
                      final countBeforeClear = registry.cachedItemCount;
                      registry.clearAll();
                      setState(() => _clearedCount = countBeforeClear);
                    },
              icon: const Icon(Icons.delete_sweep_outlined),
              label: const Text('Clear cached data'),
            ),
          ],
        ),
      ),
    );
  }
}
