import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { colors } from './theme';

/**
 * The single live-region text. Android reads `accessibilityLiveRegion`; iOS ignores it, so a
 * change of message is also announced explicitly.
 */
export function Notice({
  message,
  tone = 'info',
  style,
}: {
  message: string | null;
  tone?: 'info' | 'error';
  style?: StyleProp<TextStyle>;
}) {
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  if (!message) return null;
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.base, tone === 'error' ? styles.error : styles.info, style]}
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { textAlign: 'center', padding: 16 },
  info: { color: colors.textSecondary },
  error: { color: colors.danger },
});
