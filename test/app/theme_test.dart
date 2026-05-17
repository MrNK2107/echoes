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
}
