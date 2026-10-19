import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppNotification } from '@/data/types';
import { colors } from '@/ui/theme';

import { useInbox } from './useInbox';

/** Where a notification leads; transfer notifications stay in the inbox for now (Task 12). */
function destination(n: AppNotification): string | null {
  switch (n.type) {
    case 'memoryTagged':
      return n.data.memoryId ? `/memory/${n.data.memoryId}` : null;
    case 'communityInvite':
      return n.data.communityId ? `/communities/${n.data.communityId}` : null;
    default:
      return null;
  }
}

/** testIDs: notification-{id} */
export function InboxScreen() {
  const router = useRouter();
  const { items, loaded, unread, error, markRead, markAllRead } = useInbox();

  const open = async (n: AppNotification) => {
    // Opening never waits on, or fails because of, the read receipt.
    if (n.readAt === null) void markRead(n.id);
    const to = destination(n);
    if (to) router.push(to as never);
  };

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>{'< Back'}</Text>
      </Pressable>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={styles.title}>
          Notifications
        </Text>
        {unread > 0 ? (
          <Pressable accessibilityRole="button" onPress={markAllRead}>
            <Text style={styles.link}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={loaded ? <Text style={styles.empty}>{"You're all caught up."}</Text> : undefined}
        renderItem={({ item }) => {
          const isUnread = item.readAt === null;
          return (
            <Pressable
              testID={`notification-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${isUnread ? 'Unread. ' : ''}${item.title}. ${item.body}`}
              onPress={() => open(item)}
              style={[styles.row, isUnread && styles.rowUnread]}
            >
              {isUnread ? <View style={styles.dot} /> : null}
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, isUnread && styles.bold]}>{item.title}</Text>
                <Text style={styles.rowText}>{item.body}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  back: { paddingTop: 32, paddingBottom: 8 },
  backText: { color: colors.accent, fontSize: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  link: { color: colors.accent, fontSize: 16 },
  error: { color: colors.danger, marginVertical: 8 },
  empty: { color: colors.textSecondary, textAlign: 'center', padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 8 },
  rowUnread: { backgroundColor: colors.elevated },
  rowBody: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginRight: 10 },
  rowTitle: { color: colors.text, fontSize: 16 },
  bold: { fontWeight: '700' },
  rowText: { color: colors.textSecondary, marginTop: 2 },
});
