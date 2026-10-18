import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/ui/theme';

import { useOutbox } from './useOutbox';

export function OutboxBanner() {
  const { pending, retry } = useOutbox();
  if (pending === 0) return null;
  return (
    <View testID="outbox-banner" style={styles.banner}>
      <Text style={styles.text}>
        {pending === 1 ? '1 memory waiting to upload' : `${pending} memories waiting to upload`}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={retry} style={styles.button}>
        <Text style={styles.buttonText}>Retry</Text>
      </Pressable>
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
  text: { color: colors.text, flexShrink: 1, marginRight: 12 },
  button: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.accent },
  buttonText: { color: colors.background, fontWeight: '600' },
});
