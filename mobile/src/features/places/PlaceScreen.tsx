import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthorNames } from '@/features/people/useAuthorNames';
import { useBlocks, withoutBlocked } from '@/features/safety/useBlocks';
import { formatCount } from '@/ui/format';
import { colors } from '@/ui/theme';

import { MemoryCard } from './MemoryCard';
import { usePlaceMemories } from './usePlaceMemories';

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ERROR_COPY = "Couldn't load memories.";

export function PlaceScreen({ placeId }: { placeId: string }) {
  const router = useRouter();
  const { status, place, memories: visible } = usePlaceMemories(placeId);
  const blocked = useBlocks();
  const memories = useMemo(() => withoutBlocked(visible, blocked), [visible, blocked]);
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
          {status === 'error' ? <Text style={styles.message}>{ERROR_COPY}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {back}
      <View style={styles.header}>
        <Text style={styles.title}>{place.name}</Text>
        <View style={styles.metaRow}>
          <View testID="aura-chip" style={[styles.chip, { backgroundColor: place.aura.colorHex }]}>
            <Text style={styles.chipText}>{capitalise(place.aura.dominantSentiment)}</Text>
          </View>
          <Text style={styles.meta}>{formatCount(memories.length)}</Text>
        </View>
      </View>
      {status === 'error' ? <Text style={styles.message}>{ERROR_COPY}</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={memories}
        keyExtractor={(m) => m.id}
        extraData={names}
        renderItem={({ item }) => <MemoryCard memory={item} authorName={names.get(item.userId)} />}
        ListEmptyComponent={<Text style={styles.message}>{status === 'ready' ? 'No memories here yet.' : ''}</Text>}
      />
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
  list: { padding: 16 },
  message: { color: colors.textSecondary, textAlign: 'center', padding: 16 },
});
