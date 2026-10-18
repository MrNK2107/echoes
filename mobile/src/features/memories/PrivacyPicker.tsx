import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PrivacyType } from '@/domain/types';
import { colors } from '@/ui/theme';

export type PrivacyChoice = Extract<PrivacyType, 'public' | 'private' | 'timeRelease'>;
const CHOICES: { value: PrivacyChoice; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'timeRelease', label: 'Time release' },
];

interface Props {
  privacy: PrivacyType;
  onPrivacyChange: (privacy: PrivacyChoice) => void;
  releaseDate: Date | null;
  onReleaseDateChange: (date: Date) => void;
  now: Date;
}

/** Public | Private | Time release control plus the release-date row. testIDs: privacy-{value}, release-date-button */
export function PrivacyPicker({ privacy, onPrivacyChange, releaseDate, onReleaseDateChange, now }: Props) {
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

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 12 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentOn: { backgroundColor: colors.elevated },
  segmentText: { color: colors.textSecondary },
  segmentTextOn: { color: colors.text, fontWeight: '600' },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  rowText: { color: colors.accent, fontSize: 16 },
});
