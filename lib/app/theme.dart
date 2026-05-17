import 'package:flutter/material.dart';

class EchoesColors {
  static const deepSpace = Color(0xFF0D1117);
  static const surface = Color(0xFF161B22);
  static const elevatedSurface = Color(0xFF21262D);
  static const celestialBlue = Color(0xFF58A6FF);
  static const sunsetGold = Color(0xFFF0B429);
  static const textPrimary = Color(0xFFF0F6FC);
  static const textSecondary = Color(0xFF8B949E);

  static const positiveAura = Color(0xFFFFB347);
  static const peacefulAura = Color(0xFF77B5FE);
  static const heavyAura = Color(0xFF9B59B6);
  static const mixedAura = Color(0xFFDDA0DD);
  static const neutralAura = Color(0xFFC0C0C0);
}

class EchoesTheme {
  static ThemeData get dark {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: EchoesColors.celestialBlue,
      brightness: Brightness.dark,
      surface: EchoesColors.surface,
      primary: EchoesColors.celestialBlue,
      secondary: EchoesColors.sunsetGold,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      visualDensity: VisualDensity.standard,
      scaffoldBackgroundColor: EchoesColors.deepSpace,
      colorScheme: colorScheme,
      appBarTheme: const AppBarTheme(
        backgroundColor: EchoesColors.deepSpace,
        foregroundColor: EchoesColors.textPrimary,
        centerTitle: false,
        elevation: 0,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: EchoesColors.surface,
        selectedItemColor: EchoesColors.celestialBlue,
        unselectedItemColor: EchoesColors.textSecondary,
        type: BottomNavigationBarType.fixed,
      ),
      cardTheme: CardThemeData(
        color: EchoesColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: EchoesColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: EchoesColors.elevatedSurface),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: EchoesColors.elevatedSurface),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: EchoesColors.celestialBlue),
        ),
      ),
    );
  }
}
