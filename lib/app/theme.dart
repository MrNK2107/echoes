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
    return _buildDarkTheme(highContrast: false);
  }

  static ThemeData get highContrastDark {
    return _buildDarkTheme(highContrast: true);
  }

  static ThemeData _buildDarkTheme({required bool highContrast}) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: EchoesColors.celestialBlue,
      brightness: Brightness.dark,
      surface: highContrast ? Colors.black : EchoesColors.surface,
      primary: highContrast ? Colors.white : EchoesColors.celestialBlue,
      secondary: EchoesColors.sunsetGold,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      visualDensity: VisualDensity.standard,
      scaffoldBackgroundColor: highContrast
          ? Colors.black
          : EchoesColors.deepSpace,
      colorScheme: colorScheme,
      appBarTheme: AppBarTheme(
        backgroundColor: highContrast ? Colors.black : EchoesColors.deepSpace,
        foregroundColor: highContrast ? Colors.white : EchoesColors.textPrimary,
        centerTitle: false,
        elevation: 0,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: highContrast ? Colors.black : EchoesColors.surface,
        selectedItemColor: highContrast
            ? Colors.white
            : EchoesColors.celestialBlue,
        unselectedItemColor: highContrast
            ? const Color(0xFFE6EDF3)
            : EchoesColors.textSecondary,
        type: BottomNavigationBarType.fixed,
      ),
      cardTheme: CardThemeData(
        color: highContrast ? Colors.black : EchoesColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(
            color: highContrast ? Colors.white : Colors.transparent,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: highContrast ? Colors.black : EchoesColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(
            color: highContrast ? Colors.white : EchoesColors.elevatedSurface,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(
            color: highContrast ? Colors.white : EchoesColors.elevatedSurface,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(
            color: highContrast
                ? EchoesColors.sunsetGold
                : EchoesColors.celestialBlue,
            width: highContrast ? 2 : 1,
          ),
        ),
      ),
    );
  }
}
