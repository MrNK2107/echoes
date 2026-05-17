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
    final primaryColor = highContrast
        ? Colors.white
        : EchoesColors.celestialBlue;
    final textColor = highContrast ? Colors.white : EchoesColors.textPrimary;
    final secondaryTextColor = highContrast
        ? const Color(0xFFE6EDF3)
        : EchoesColors.textSecondary;
    final surfaceColor = highContrast ? Colors.black : EchoesColors.surface;
    final borderColor = highContrast
        ? Colors.white
        : EchoesColors.elevatedSurface;

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      visualDensity: VisualDensity.standard,
      scaffoldBackgroundColor: highContrast
          ? Colors.black
          : EchoesColors.deepSpace,
      colorScheme: colorScheme,
      textTheme: ThemeData.dark().textTheme.apply(
        bodyColor: textColor,
        displayColor: textColor,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: highContrast ? Colors.black : EchoesColors.deepSpace,
        foregroundColor: textColor,
        centerTitle: false,
        elevation: 0,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: surfaceColor,
        selectedItemColor: primaryColor,
        unselectedItemColor: secondaryTextColor,
        type: BottomNavigationBarType.fixed,
      ),
      cardTheme: CardThemeData(
        color: surfaceColor,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: highContrast ? Colors.white : borderColor),
        ),
      ),
      dividerTheme: DividerThemeData(color: borderColor, thickness: 1),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: primaryColor),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: highContrast ? Colors.black : EchoesColors.deepSpace,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          minimumSize: const Size(48, 48),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryColor,
          side: BorderSide(color: borderColor),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          minimumSize: const Size(48, 48),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primaryColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          minimumSize: const Size(48, 48),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: surfaceColor,
        selectedColor: highContrast
            ? Colors.white
            : EchoesColors.celestialBlue.withValues(alpha: 0.18),
        disabledColor: surfaceColor,
        labelStyle: TextStyle(color: textColor),
        secondaryLabelStyle: TextStyle(
          color: highContrast ? Colors.black : textColor,
        ),
        side: BorderSide(color: borderColor),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: EchoesColors.elevatedSurface,
        contentTextStyle: TextStyle(color: textColor),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceColor,
        labelStyle: TextStyle(color: secondaryTextColor),
        helperStyle: TextStyle(color: secondaryTextColor),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: borderColor),
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
