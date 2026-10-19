import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuraHistoryChart } from '@/features/aura/AuraHistoryChart';
import { useSession } from '@/features/auth/useSession';
import { useAuthorNames } from '@/features/people/useAuthorNames';
import { useBlocksState, withoutBlocked } from '@/features/safety/useBlocks';
import { REQUEST_SENT, TransferSheet } from '@/features/transfers/TransferSheet';
import { capitalise, formatCount } from '@/ui/format';
import { FEED_LOAD_ERROR } from '@/ui/copy';
import { colors } from '@/ui/theme';

import { MemoryCard } from './MemoryCard';
import { usePlaceMemories } from './usePlaceMemories';


export function PlaceScreen({ placeId }: { placeId: string }) {
  const router = useRouter();
  const { session } = useSession();
  const { status, place, memories: visible } = usePlaceMemories(placeId);
  const [transferring, setTransferring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const blocks = useBlocksState();
  // Nothing renders until the block list is known, so a blocked author's memory never flashes.
  const memories = useMemo(
    () => (blocks.ready ? withoutBlocked(visible, blocks.blocked) : []),
    [visible, blocks.ready, blocks.blocked],
  );
  const listReady = status === 'ready' && blocks.ready;
  const listError = status === 'error' || blocks.error;
  const authorIds = useMemo(() => memories.map((m) => m.userId), [memories]);
  const names = useAuthorNames(authorIds);

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
      <Text style={styles.backText}>{'< Back'}</Text>
    </Pressable>
  );

  if (!place) {
    return (
      <View style={styles.container}>
        {back}
        <View style={styles.center}>
          {status === 'notFound' ? <Text style={styles.message}>This place no longer exists.</Text> : null}
          {status === 'error' ? <Text style={styles.message}>{FEED_LOAD_ERROR}</Text> : null}
        </View>
      </View>
    );
  }

  const isCustodian = !!session && place.custodianIds.includes(session.userId);

  return (
    <View style={styles.container}>
      {back}
      <View style={styles.header}>
        <Text style={styles.title}>{place.name}</Text>
        <View style={styles.metaRow}>
          <View testID="aura-chip" style={[styles.chip, { backgroundColor: place.aura.colorHex }]}>
            <Text style={styles.chipText}>{capitalise(place.aura.dominantSentiment)}</Text>
          </View>
          {listReady ? <Text style={styles.meta}>{formatCount(memories.length)}</Text> : null}
        </View>
        <AuraHistoryChart key={placeId} placeId={placeId} />
        {isCustodian ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setNotice(null);
              setTransferring(true);
            }}
            style={styles.action}
          >
            <Text style={styles.actionText}>Transfer custodianship</Text>
          </Pressable>
        ) : null}
        {notice ? (
          <Text role="status" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
      </View>
      {listError ? <Text style={styles.message}>{FEED_LOAD_ERROR}</Text> : null}
      {!listReady && !listError ? <ActivityIndicator style={styles.spinner} color={colors.accent} /> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={memories}
        keyExtractor={(m) => m.id}
        extraData={names}
        renderItem={({ item }) => <MemoryCard memory={item} authorName={names.get(item.userId)} />}
        ListEmptyComponent={<Text style={styles.message}>{listReady ? 'No memories here yet.' : ''}</Text>}
      />
      {isCustodian ? (
        <TransferSheet
          place={place}
          visible={transferring}
          onClose={() => setTransferring(false)}
          onSent={() => {
            setTransferring(false);
            setNotice(REQUEST_SENT);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  back: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { color: colors.accent, fontSize: 16 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: colors.background, fontWeight: '600' },
  meta: { color: colors.textSecondary },
  action: { alignSelf: 'flex-start', borderColor: colors.accent, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12 },
  actionText: { color: colors.accent, fontWeight: '600' },
  notice: { color: colors.textSecondary, marginTop: 8 },
  list: { padding: 16 },
  spinner: { marginTop: 16 },
  message: { color: colors.textSecondary, textAlign: 'center', padding: 16 },
});
