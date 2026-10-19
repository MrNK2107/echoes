import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CrashReporter } from '@/device/types';

import { Notice } from './Notice';
import { colors } from './theme';

/** Root error boundary body: reports once and shows generic copy. The reporter is a prop because the boundary renders outside the providers. */
export function ErrorFallback({
  error,
  retry,
  reporter,
}: {
  error: Error;
  retry: () => void;
  reporter: CrashReporter;
}) {
  useEffect(() => {
    reporter.captureException(error, { source: 'error-boundary' });
  }, [error, reporter]);

  return (
    <View style={styles.root}>
      <Notice tone="error" message="Something went wrong. Please try again." />
      <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={retry} style={styles.button}>
        <Text style={styles.label}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.background },
  button: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center' },
  label: { color: colors.text },
});
