import 'package:echoes/app/theme.dart';
import 'package:flutter/material.dart';

class ErrorFallback extends StatelessWidget {
  const ErrorFallback({required this.details, super.key});

  final FlutterErrorDetails details;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: EchoesColors.deepSpace,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: EchoesColors.surface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: EchoesColors.elevatedSurface),
            ),
            child: const Padding(
              padding: EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.error_outline,
                    color: EchoesColors.sunsetGold,
                    size: 32,
                  ),
                  SizedBox(height: 12),
                  Text(
                    'Something went wrong',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: EchoesColors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Please restart the app and try again.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: EchoesColors.textSecondary,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
