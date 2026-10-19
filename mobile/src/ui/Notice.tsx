import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

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

  // The host stays mounted so assistive tech registers the live region before text arrives.
  return (
    <View
      testID="notice-region"
      accessibilityLiveRegion="polite"
      accessibilityRole={message ? 'alert' : undefined}
      accessible={!!message}
    >
      {message ? <Text style={[styles.base, tone === 'error' ? styles.error : styles.info, style]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  info: { color: colors.textSecondary },
  error: { color: colors.danger },
});
