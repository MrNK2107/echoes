import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { GENERIC_ERROR, RESTORE_EXPIRED } from '@/data/errors';
import { canRestore, restoreDaysLeft } from '@/domain/memoryLifecycle';
import type { Memory } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

export function RecentlyDeletedScreen() {
  const router = useRouter();
  const { repos, now } = useServices();
  const { session } = useSession();
  const uid = session?.userId;
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const restoringRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!uid) return;
    return repos.memories.subscribeDeletedForUser(
      uid,
      (list) => {
        setMemories(list);
        setLoaded(true);
      },
      () => {
        setLoaded(true);
        setError(GENERIC_ERROR);
      },
    );
  }, [repos.memories, uid]);

  const current = now();
  const visible = memories.filter((m) => canRestore(m, current));

  const restore = async (id: string) => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    setRestoringId(id);
    setError(null);
    try {
      await repos.memories.restore(id, now());
    } catch (e) {
      if (mounted.current) setError(e instanceof Error && e.message === RESTORE_EXPIRED ? RESTORE_EXPIRED : GENERIC_ERROR);
    } finally {
      restoringRef.current = false;
      if (mounted.current) setRestoringId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>{'< Back'}</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        Recently deleted
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <FlatList
        data={visible}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loaded ? (
            <Text style={styles.empty}>Nothing here. Deleted memories stay restorable for 30 days.</Text>
          ) : undefined
        }
        renderItem={({ item }) => {
          const days = restoreDaysLeft(item, current);
          return (
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text numberOfLines={2} style={styles.text}>
                  {item.textContent}
                </Text>
                <Text style={styles.meta}>{days === 1 ? 'Restorable for 1 day' : `Restorable for ${days} days`}</Text>
              </View>
              <Pressable
                testID={`restore-${item.id}`}
                accessibilityRole="button"
                disabled={restoringId !== null}
                onPress={() => restore(item.id)}
                style={[styles.action, restoringId !== null && styles.disabled]}
              >
                <Text style={styles.actionText}>Restore</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { color: colors.accent, fontSize: 16 },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  error: { color: colors.danger, paddingHorizontal: 16, paddingBottom: 8 },
  list: { padding: 16, gap: 12 },
  empty: { color: colors.textSecondary, textAlign: 'center', padding: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  rowText: { flex: 1 },
  text: { color: colors.text, fontSize: 16 },
  meta: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  action: {
    backgroundColor: colors.elevated,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
