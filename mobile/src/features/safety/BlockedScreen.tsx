import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { GENERIC_ERROR } from '@/data/errors';
import { useSession } from '@/features/auth/useSession';
import { useAuthorNames } from '@/features/people/useAuthorNames';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

import { useBlocksState } from './useBlocks';

/** Shown while a blocked person's profile is loading or missing. */
const UNKNOWN_NAME = 'Someone';

/** testIDs: blocked-{uid} */
export function BlockedScreen() {
  const router = useRouter();
  const { repos } = useServices();
  const { session } = useSession();
  const blocks = useBlocksState();
  // useBlocksState keeps the repository's order (most recently blocked first).
  const ids = useMemo(() => [...blocks.blocked], [blocks.blocked]);
  const names = useAuthorNames(ids);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const unblock = async (other: string) => {
    if (!session || pending.has(other)) return;
    setError(null);
    setPending((p) => new Set(p).add(other));
    try {
      // The live block list drops the row and restores the person's memories everywhere.
      await repos.safety.unblock(session.userId, other);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(other);
        return next;
      });
    }
  };

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>{'< Back'}</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        Blocked people
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {!blocks.ready && !blocks.error ? <ActivityIndicator style={styles.spinner} color={colors.accent} /> : null}
      {blocks.error ? <Text style={styles.message}>{"Couldn't load blocked people."}</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={ids}
        keyExtractor={(id) => id}
        ListEmptyComponent={blocks.ready ? <Text style={styles.message}>{"You haven't blocked anyone."}</Text> : undefined}
        renderItem={({ item }) => {
          const name = names.get(item) ?? UNKNOWN_NAME;
          const busy = pending.has(item);
          return (
            <View testID={`blocked-${item}`} style={styles.row}>
              <Text style={styles.name}>{name}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${name}`}
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => void unblock(item)}
                style={[styles.unblock, busy && styles.disabled]}
              >
                <Text style={styles.unblockText}>Unblock</Text>
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
  title: { color: colors.text, fontSize: 24, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 12 },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  name: { color: colors.text, fontSize: 16, flexShrink: 1 },
  unblock: { borderRadius: 20, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8 },
  unblockText: { color: colors.accent, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  spinner: { marginTop: 16 },
  error: { color: colors.danger, paddingHorizontal: 16 },
  message: { color: colors.textSecondary, textAlign: 'center', padding: 16 },
});
