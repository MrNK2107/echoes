import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { GENERIC_ERROR, TIMEOUT_ERROR } from '@/data/errors';
import { useSession } from '@/features/auth/useSession';
import { TimeoutError, withTimeout } from '@/features/memories/submitMemory';
import { useAuthorNames } from '@/features/people/useAuthorNames';
import { useServices } from '@/services/ServicesProvider';
import { SOMEONE } from '@/ui/copy';
import { Notice } from '@/ui/Notice';
import { BackButton } from '@/ui/BackButton';
import { colors } from '@/ui/theme';

import { useBlocksState } from './useBlocks';

/** testIDs: blocked-{uid} */
export function BlockedScreen() {
  const { repos } = useServices();
  const { session } = useSession();
  const blocks = useBlocksState();
  // useBlocksState keeps the repository's order (most recently blocked first).
  const ids = useMemo(() => [...blocks.blocked], [blocks.blocked]);
  const names = useAuthorNames(ids);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const unblocking = useRef(new Set<string>());

  const unblock = async (other: string) => {
    if (!session || unblocking.current.has(other)) return;
    unblocking.current.add(other);
    setError(null);
    setPending((p) => new Set(p).add(other));
    try {
      // The live block list drops the row and restores the person's memories everywhere.
      await withTimeout(repos.safety.unblock(session.userId, other));
    } catch (e) {
      setError(e instanceof TimeoutError ? TIMEOUT_ERROR : GENERIC_ERROR);
    } finally {
      unblocking.current.delete(other);
      setPending((p) => {
        const next = new Set(p);
        next.delete(other);
        return next;
      });
    }
  };

  return (
    <View style={styles.container}>
      <BackButton />
      <Text accessibilityRole="header" style={styles.title}>
        Blocked people
      </Text>
      <Notice tone="error" message={error} style={styles.error} />
      {!blocks.ready && !blocks.error ? <ActivityIndicator style={styles.spinner} color={colors.accent} /> : null}
      {blocks.error ? <Text style={styles.message}>{"Couldn't load blocked people."}</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={ids}
        keyExtractor={(id) => id}
        ListEmptyComponent={blocks.ready ? <Text style={styles.message}>{"You haven't blocked anyone."}</Text> : undefined}
        renderItem={({ item }) => {
          const name = names.get(item) ?? SOMEONE;
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
