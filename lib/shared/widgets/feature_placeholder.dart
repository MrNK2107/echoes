import 'package:echoes/app/theme.dart';
import 'package:flutter/material.dart';

class FeaturePlaceholder extends StatelessWidget {
  const FeaturePlaceholder({
    required this.icon,
    required this.title,
    required this.description,
    required this.nextStep,
    this.action,
    super.key,
  });

  final IconData icon;
  final String title;
  final String description;
  final String nextStep;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: EchoesColors.celestialBlue.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: EchoesColors.celestialBlue, size: 32),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              style: textTheme.headlineMedium?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              description,
              style: textTheme.bodyLarge?.copyWith(
                color: EchoesColors.textSecondary,
                height: 1.45,
              ),
            ),
            if (action != null) ...[const SizedBox(height: 24), action!],
            const Spacer(),
            DecoratedBox(
              decoration: BoxDecoration(
                color: EchoesColors.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: EchoesColors.elevatedSurface),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.flag_outlined,
                      color: EchoesColors.sunsetGold,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        nextStep,
                        style: textTheme.bodyMedium?.copyWith(
                          color: EchoesColors.textPrimary,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
