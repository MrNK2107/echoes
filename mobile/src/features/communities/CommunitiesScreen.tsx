import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Community } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

import { CreateCommunitySheet } from './CreateCommunitySheet';
import { communityTypeLabel, formatMembers } from './labels';

type Segment = 'mine' | 'discover';
const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'mine', label: 'Mine' },
  { value: 'discover', label: 'Discover' },
];

type ListState = { key: string; status: 'ready'; communities: Community[] } | { key: string; status: 'error' };

/** Mine (users/{uid}.communityIds) or Discover (largest first), live. */
function useCommunityList(segment: Segment): { status: 'loading' | 'ready' | 'error'; communities: Community[] } {
  const { repos } = useServices();
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const key = `${segment}:${uid ?? ''}`;
  const [state, setState] = useState<ListState | null>(null);

  useEffect(() => {
    if (!uid) return;
    const onList = (communities: Community[]) => setState({ key, status: 'ready', communities });
    const onError = (e: Error) => {
      console.warn('Could not load communities', e);
      setState({ key, status: 'error' });
    };
    return segment === 'mine'
      ? repos.communities.subscribeMine(uid, onList, onError)
      : repos.communities.subscribeDiscover(onList, onError);
  }, [repos.communities, segment, uid, key]);

  if (!state || state.key !== key) return { status: 'loading', communities: [] };
  return state.status === 'ready' ? state : { status: 'error', communities: [] };
}

/** testIDs: community-row-{id} */
export function CommunitiesScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('mine');
  const [creating, setCreating] = useState(false);
  const { status, communities } = useCommunityList(segment);

  const open = (id: string) => router.push(`/communities/${id}`);

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>{'< Back'}</Text>
      </Pressable>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={styles.title}>
          Communities
        </Text>
        <Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={styles.create}>
          <Text style={styles.createText}>Create community</Text>
        </Pressable>
      </View>

      <View style={styles.segmented}>
        {SEGMENTS.map((s) => (
          <Pressable
            key={s.value}
            accessibilityRole="button"
            accessibilityState={{ selected: segment === s.value }}
            onPress={() => setSegment(s.value)}
            style={[styles.segment, segment === s.value && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, segment === s.value && styles.segmentTextOn]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {status === 'loading' ? <ActivityIndicator style={styles.spinner} color={colors.accent} /> : null}
      {status === 'error' ? (
        <Text accessibilityRole="alert" style={styles.message}>
          {"Couldn't load communities."}
        </Text>
      ) : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={communities}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={
          status === 'ready' ? (
            <Text style={styles.message}>
              {segment === 'mine' ? "You haven't joined a community yet." : 'No communities yet.'}
            </Text>
          ) : undefined
        }
        renderItem={({ item }) => {
          const type = communityTypeLabel(item.type);
          const members = formatMembers(item.memberCount);
          return (
            <Pressable
              testID={`community-row-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${type}, ${members}`}
              onPress={() => open(item.id)}
              style={styles.row}
            >
              <Text style={styles.name}>{item.name}</Text>
              <View style={styles.metaRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{type}</Text>
                </View>
                <Text style={styles.meta}>{members}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <CreateCommunitySheet
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          open(id);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { color: colors.accent, fontSize: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '600' },
  create: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  createText: { color: colors.background, fontWeight: '600' },
  segmented: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  segment: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: 10, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.accent },
  segmentText: { color: colors.text },
  segmentTextOn: { color: colors.background, fontWeight: '600' },
  list: { padding: 16 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  badge: { backgroundColor: colors.elevated, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.gold, fontSize: 12 },
  meta: { color: colors.textSecondary },
  spinner: { marginTop: 16 },
  message: { color: colors.textSecondary, textAlign: 'center', padding: 16 },
});
