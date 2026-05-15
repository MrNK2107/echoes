import 'package:echoes/app/theme.dart';
import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:flutter/material.dart';

class AuraPreview extends StatelessWidget {
  const AuraPreview({required this.aura, super.key});

  final AuraZone aura;

  @override
  Widget build(BuildContext context) {
    final color = aura.color;
    final intensityPercent = (aura.intensity * 100).round();

    return Semantics(
      label:
          'Aura ${aura.dominantSentiment.name}, $intensityPercent percent intensity',
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: EchoesColors.elevatedSurface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.42)),
        ),
        child: Row(
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color.withValues(alpha: _fillAlpha(aura.intensity)),
                border: Border.all(color: color, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: _glowAlpha(aura.intensity)),
                    blurRadius: 20,
                    spreadRadius: 4,
                  ),
                ],
              ),
              child: Icon(Icons.blur_circular, color: color, size: 34),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Aura',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: EchoesColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _sentimentLabel(aura),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: EchoesColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: aura.intensity,
                    minHeight: 6,
                    color: color,
                    backgroundColor: EchoesColors.deepSpace,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '$intensityPercent% intensity from ${aura.memoryCount} public memories',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: EchoesColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  double _fillAlpha(double intensity) {
    return 0.16 + (intensity * 0.38);
  }

  double _glowAlpha(double intensity) {
    return 0.12 + (intensity * 0.28);
  }

  String _sentimentLabel(AuraZone aura) {
    final name = aura.dominantSentiment.name;
    return '${name[0].toUpperCase()}${name.substring(1)}';
  }
}
