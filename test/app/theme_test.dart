import 'package:echoes/app/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('EchoesTheme keeps Material touch targets padded', () {
    final theme = EchoesTheme.dark;

    expect(theme.materialTapTargetSize, MaterialTapTargetSize.padded);
    expect(theme.visualDensity, VisualDensity.standard);
  });

  test('EchoesTheme exposes a high contrast dark theme', () {
    final theme = EchoesTheme.highContrastDark;

    expect(theme.scaffoldBackgroundColor, Colors.black);
    expect(theme.colorScheme.primary, Colors.white);
    expect(theme.bottomNavigationBarTheme.selectedItemColor, Colors.white);
    expect(theme.inputDecorationTheme.focusedBorder, isA<OutlineInputBorder>());
  });

  test('EchoesTheme polishes shared dark component styles', () {
    final theme = EchoesTheme.dark;

    expect(theme.cardTheme.shape, isA<RoundedRectangleBorder>());
    expect(
      theme.filledButtonTheme.style?.minimumSize?.resolve({}),
      const Size(48, 48),
    );
    expect(
      theme.outlinedButtonTheme.style?.shape?.resolve({}),
      isA<RoundedRectangleBorder>(),
    );
    expect(
      theme.textButtonTheme.style?.shape?.resolve({}),
      isA<RoundedRectangleBorder>(),
    );
    expect(theme.snackBarTheme.behavior, SnackBarBehavior.floating);
    expect(theme.chipTheme.shape, isA<RoundedRectangleBorder>());
    expect(theme.progressIndicatorTheme.color, EchoesColors.celestialBlue);
  });
}
