import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { messageOf } from '@/data/errors';
import type { AppNotification } from '@/data/types';
import { useIncomingTransfers } from '@/features/transfers/useTransfers';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

import { useInbox } from './useInbox';

/** Where a notification leads; transfer notifications are answered in the inbox itself. */
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
  const { repos } = useServices();
  const { items, loaded, unread, error, markRead, markAllRead } = useInbox();
  const incoming = useIncomingTransfers();
  const pendingIds = useMemo(() => new Set(incoming.items.map((t) => t.id)), [incoming.items]);
  const [answering, setAnswering] = useState<string | null>(null);
  const answeringRef = useRef(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const rowState = useMemo(
    () => ({ pendingIds, answering, failed: incoming.error }),
    [pendingIds, answering, incoming.error],
  );

  /** Accept/Decline show while the request is pending (or when pending requests failed to load). */
  const answerable = (n: AppNotification): string | null => {
    const id = n.type === 'transferRequest' ? n.data.transferId : undefined;
    if (!id) return null;
    return incoming.error || pendingIds.has(id) ? id : null;
  };

  const answer = async (n: AppNotification, transferId: string, accept: boolean) => {
    if (answeringRef.current) return;
    answeringRef.current = true;
    setAnswering(transferId);
    setAnswerError(null);
    if (n.readAt === null) void markRead(n.id);
    try {
      await repos.transfers.respond(transferId, accept);
    } catch (e) {
      // Already answered, revoked or past the window: the server refuses; the copy stays generic.
      setAnswerError(messageOf(e));
    } finally {
      answeringRef.current = false;
      setAnswering(null);
    }
  };

  const open = async (n: AppNotification) => {
    // Opening never waits on, or fails because of, the read receipt.
    if (n.readAt === null) void markRead(n.id);
    const to = destination(n);
    if (to) router.push(to);
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
      {answerError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {answerError}
        </Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        extraData={rowState}
        ListEmptyComponent={loaded ? <Text style={styles.empty}>{"You're all caught up."}</Text> : undefined}
        renderItem={({ item }) => {
          const isUnread = item.readAt === null;
          const transferId = answerable(item);
          const busy = answering !== null;
          const row = (
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
          if (!transferId) return row;
          // Siblings of the row, not children, so screen readers reach each button.
          return (
            <View>
              {row}
              <View style={styles.answers}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={item.body}
                  accessibilityState={{ disabled: busy, busy: answering === transferId }}
                  disabled={busy}
                  onPress={() => void answer(item, transferId, false)}
                  style={[styles.secondary, busy && styles.disabled]}
                >
                  <Text style={styles.secondaryText}>Decline</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={item.body}
                  accessibilityState={{ disabled: busy, busy: answering === transferId }}
                  disabled={busy}
                  onPress={() => void answer(item, transferId, true)}
                  style={[styles.primary, busy && styles.disabled]}
                >
                  <Text style={styles.primaryText}>Accept</Text>
                </Pressable>
              </View>
            </View>
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
  answers: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  primary: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  primaryText: { color: colors.background, fontWeight: '600' },
  secondary: { borderColor: colors.accent, borderWidth: 1, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
