import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { GENERIC_ERROR } from '@/data/errors';
import type { Community, PrivacyType } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { UserSearchField } from '@/features/people/UserSearchField';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

export type PrivacyChoice = PrivacyType;
const CHOICES: { value: PrivacyChoice; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'timeRelease', label: 'Time release' },
  { value: 'tagged', label: 'Tagged' },
  { value: 'community', label: 'Community' },
];

interface Props {
  privacy: PrivacyType;
  onPrivacyChange: (privacy: PrivacyChoice) => void;
  releaseDate: Date | null;
  onReleaseDateChange: (date: Date) => void;
  taggedUserIds: string[];
  onTaggedUserIdsChange: (ids: string[]) => void;
  communityId: string | null;
  onCommunityChange: (id: string) => void;
  now: Date;
}

/**
 * Public | Private | Time release | Tagged | Community, plus the release-date row, the people
 * search (tagged) or the community list (community).
 * testIDs: privacy-{value}, release-date-button, community-{id}
 */
export function PrivacyPicker({
  privacy,
  onPrivacyChange,
  releaseDate,
  onReleaseDateChange,
  taggedUserIds,
  onTaggedUserIdsChange,
  communityId,
  onCommunityChange,
  now,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <>
      <View style={styles.segmented}>
        {CHOICES.map((c) => (
          <Pressable
            key={c.value}
            testID={`privacy-${c.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected: privacy === c.value }}
            onPress={() => onPrivacyChange(c.value)}
            style={[styles.segment, privacy === c.value && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, privacy === c.value && styles.segmentTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      {privacy === 'timeRelease' ? (
        <Pressable
          testID="release-date-button"
          accessibilityRole="button"
          onPress={() => setPickerOpen(true)}
          style={styles.row}
        >
          <Text style={styles.rowText}>{releaseDate ? releaseDate.toDateString() : 'Choose release date'}</Text>
        </Pressable>
      ) : null}
      {privacy === 'tagged' ? <UserSearchField selectedIds={taggedUserIds} onChange={onTaggedUserIdsChange} /> : null}
      {privacy === 'community' ? <CommunityChooser selectedId={communityId} onChoose={onCommunityChange} /> : null}
      {pickerOpen ? (
        <DateTimePicker
          value={releaseDate ?? now}
          mode="date"
          minimumDate={now}
          onChange={(event, date) => {
            setPickerOpen(false);
            if (event.type === 'set' && date) onReleaseDateChange(date);
          }}
        />
      ) : null}
    </>
  );
}

type MineState = { status: 'loading' } | { status: 'ready'; communities: Community[] } | { status: 'error' };

/** The signed-in user's communities (users/{uid}.communityIds) as a single-choice list. */
function CommunityChooser({ selectedId, onChoose }: { selectedId: string | null; onChoose: (id: string) => void }) {
  const { repos } = useServices();
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const [state, setState] = useState<{ uid: string | null; mine: MineState }>({
    uid: null,
    mine: { status: 'loading' },
  });

  useEffect(() => {
    if (!uid) return;
    return repos.communities.subscribeMine(
      uid,
      (communities) => setState({ uid, mine: { status: 'ready', communities } }),
      () => setState({ uid, mine: { status: 'error' } }),
    );
  }, [repos.communities, uid]);

  const mine: MineState = state.uid === uid ? state.mine : { status: 'loading' };
  return (
    <View style={styles.communities}>
      <Text style={styles.label}>Choose a community</Text>
      {mine.status === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
      {mine.status === 'error' ? <Text style={styles.error}>{GENERIC_ERROR}</Text> : null}
      {mine.status === 'ready' && mine.communities.length === 0 ? (
        <Text style={styles.hint}>Join a community first.</Text>
      ) : null}
      {mine.status === 'ready'
        ? mine.communities.map((c) => (
            <Pressable
              key={c.id}
              testID={`community-${c.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedId === c.id }}
              onPress={() => onChoose(c.id)}
              style={[styles.row, selectedId === c.id && styles.rowOn]}
            >
              <Text style={[styles.communityText, selectedId === c.id && styles.segmentTextOn]}>{c.name}</Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  segment: { flexGrow: 1, flexBasis: '30%', paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentOn: { backgroundColor: colors.elevated },
  segmentText: { color: colors.textSecondary },
  segmentTextOn: { color: colors.text, fontWeight: '600' },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  rowText: { color: colors.accent, fontSize: 16 },
  rowOn: { backgroundColor: colors.elevated, borderColor: colors.accent, borderWidth: 1 },
  communities: { marginBottom: 12 },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 6 },
  hint: { color: colors.textSecondary },
  error: { color: colors.danger },
  communityText: { color: colors.text, fontSize: 16 },
});
