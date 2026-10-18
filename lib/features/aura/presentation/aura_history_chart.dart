import 'package:echoes/app/theme.dart';
import 'package:echoes/features/aura/domain/aura_history_entry.dart';
import 'package:echoes/features/aura/domain/aura_history_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class AuraHistoryChart extends StatelessWidget {
  const AuraHistoryChart({required this.placeId, super.key});

  final String placeId;

  @override
  Widget build(BuildContext context) {
    final repository = context.read<AuraHistoryRepository>();

    return StreamBuilder<List<AuraHistoryEntry>>(
      stream: repository.watchAuraHistory(placeId, limit: 14),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SizedBox(
            height: 80,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          );
        }

        final entries = snapshot.data ?? const <AuraHistoryEntry>[];
        if (entries.isEmpty) {
          return const SizedBox.shrink();
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Aura history',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 100,
              child: CustomPaint(
                size: const Size(double.infinity, 100),
                painter: _AuraHistoryPainter(entries: entries),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _AuraHistoryPainter extends CustomPainter {
  _AuraHistoryPainter({required this.entries});

  final List<AuraHistoryEntry> entries;

  @override
  void paint(Canvas canvas, Size size) {
    if (entries.isEmpty) {
      return;
    }

    final reversed = entries.reversed.toList();
    final barWidth = (size.width - 24) / reversed.length;
    const maxBarHeight = 72.0;

    for (var i = 0; i < reversed.length; i++) {
      final entry = reversed[i];
      final aura = entry.aura;
      final barHeight = aura.intensity * maxBarHeight;
      final x = 12.0 + i * barWidth + barWidth * 0.15;
      final barW = barWidth * 0.7;
      final y = size.height - 16 - barHeight;

      final paint = Paint()
        ..color = aura.color.withValues(alpha: 0.75 + aura.intensity * 0.25)
        ..style = PaintingStyle.fill;

      canvas.drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(x, y, barW, barHeight),
          topLeft: const Radius.circular(3),
          topRight: const Radius.circular(3),
        ),
        paint,
      );
    }

    // Draw baseline
    final baselinePaint = Paint()
      ..color = EchoesColors.elevatedSurface
      ..strokeWidth = 1;
    canvas.drawLine(
      Offset(12, size.height - 16),
      Offset(size.width - 12, size.height - 16),
      baselinePaint,
    );
  }

  @override
  bool shouldRepaint(covariant _AuraHistoryPainter oldDelegate) {
    if (oldDelegate.entries.length != entries.length) {
      return true;
    }
    for (var i = 0; i < entries.length; i++) {
      if (oldDelegate.entries[i].aura.compoundScore !=
          entries[i].aura.compoundScore) {
        return true;
      }
    }
    return false;
  }
}
