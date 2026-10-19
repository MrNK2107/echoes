import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BellIcon } from '@/ui/icons';
import { colors } from '@/ui/theme';

import { useInbox } from './useInbox';

/** Header button for the inbox; the badge shows the unread count, capped at 9+. */
export function InboxBell({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { unread } = useInbox();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      accessibilityValue={unread > 0 ? { text: `${unread > 9 ? '9+' : unread} unread` } : undefined}
      onPress={() => router.push('/notifications' as never)}
      style={styles.bell}
    >
      {compact ? <BellIcon /> : <Text style={styles.text}>Alerts</Text>}
      {unread > 0 ? (
        <View testID="inbox-badge" style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    backgroundColor: colors.accent,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  text: { color: colors.background, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '700' },
});
