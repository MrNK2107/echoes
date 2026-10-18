import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/ui/theme';

import { useOutbox } from './useOutbox';

function pendingCopy(n: number): string {
  return n === 1 ? '1 memory waiting to upload' : `${n} memories waiting to upload`;
}

function failedCopy(n: number): string {
  return n === 1 ? "1 memory couldn't upload" : `${n} memories couldn't upload`;
}

export function OutboxBanner() {
  const { pending, failed, retry, discardFailed } = useOutbox();
  if (pending === 0 && failed === 0) return null;

  const confirmDiscard = () =>
    Alert.alert("Discard memories that couldn't upload?", "They can't be recovered.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: discardFailed },
    ]);

  return (
    <View testID="outbox-banner" style={styles.banner}>
      <View style={styles.lines}>
        {pending > 0 ? <Text style={styles.text}>{pendingCopy(pending)}</Text> : null}
        {failed > 0 ? <Text style={[styles.text, styles.failed]}>{failedCopy(failed)}</Text> : null}
      </View>
      <View style={styles.actions}>
        {failed > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Discard" onPress={confirmDiscard} style={styles.secondary}>
            <Text style={styles.secondaryText}>Discard</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={retry} style={styles.button}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.elevated,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  lines: { flexShrink: 1, marginRight: 12, gap: 2 },
  text: { color: colors.text },
  failed: { color: colors.danger },
  actions: { flexDirection: 'row', gap: 8 },
  button: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.accent },
  buttonText: { color: colors.background, fontWeight: '600' },
  secondary: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.textSecondary },
  secondaryText: { color: colors.text, fontWeight: '600' },
});
