import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { LatLng, PrivacyType } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

import { MAX_MEMORY_LENGTH, submitMemory } from './submitMemory';

type Choice = Extract<PrivacyType, 'public' | 'private' | 'timeRelease'>;
const CHOICES: { value: Choice; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'timeRelease', label: 'Time release' },
];
const PERMISSION_COPY = 'Location permission is needed to save a memory here.';

/** testIDs: text-input, privacy-{value}, release-date-button, use-location-button, add-photo-button, photo-thumbnail, save-button, back-button */
export function AddMemoryScreen() {
  const router = useRouter();
  const services = useServices();
  const { session } = useSession();
  const [text, setText] = useState('');
  const [privacy, setPrivacy] = useState<Choice>('public');
  const [releaseDate, setReleaseDate] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const captureLocation = async () => {
    setError(null);
    try {
      if ((await services.location.requestPermission()) !== 'granted') {
        setError(PERMISSION_COPY);
        return;
      }
      setLocation(await services.location.getCurrentPosition());
    } catch {
      setError('Could not get your location. Try again.');
    }
  };

  const addPhoto = async () => {
    setError(null);
    try {
      const picked = await services.imagePicker.pick('library');
      if (picked) setImageUri(picked.uri);
    } catch {
      setError('Could not open your photos.');
    }
  };

  const save = async () => {
    if (!session || submitting) return;
    setError(null);
    setSubmitting(true);
    const result = await submitMemory(services, session.userId, {
      textContent: text,
      privacy,
      releaseDate: privacy === 'timeRelease' ? releaseDate : null,
      taggedUserIds: [],
      communityId: null,
      location,
      imageUri,
    });
    setSubmitting(false);
    if (result.ok) router.replace(`/place/${result.placeId}`);
    else setError(result.error);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable
        testID="back-button"
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={styles.back}
      >
        <Text style={styles.backText}>{'< Back'}</Text>
      </Pressable>
      <TextInput
        testID="text-input"
        style={styles.input}
        multiline
        value={text}
        onChangeText={setText}
        placeholder="What do you want to remember here?"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Memory text"
      />
      <Text style={styles.counter}>{`${text.length}/${MAX_MEMORY_LENGTH}`}</Text>

      <View style={styles.segmented}>
        {CHOICES.map((c) => (
          <Pressable
            key={c.value}
            testID={`privacy-${c.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected: privacy === c.value }}
            onPress={() => setPrivacy(c.value)}
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
          value={releaseDate ?? services.now()}
          mode="date"
          minimumDate={services.now()}
          onChange={(event, date) => {
            setPickerOpen(false);
            if (event.type === 'set' && date) setReleaseDate(date);
          }}
        />
      ) : null}

      <Pressable testID="use-location-button" accessibilityRole="button" onPress={captureLocation} style={styles.row}>
        <Text style={styles.rowText}>Use my location</Text>
      </Pressable>
      {location ? <Text style={styles.ok}>Location captured</Text> : null}

      <Pressable testID="add-photo-button" accessibilityRole="button" onPress={addPhoto} style={styles.row}>
        <Text style={styles.rowText}>Add photo</Text>
      </Pressable>
      {imageUri ? (
        <View style={styles.photoRow}>
          <Image testID="photo-thumbnail" source={{ uri: imageUri }} style={styles.thumb} />
          <Pressable accessibilityRole="button" onPress={() => setImageUri(null)}>
            <Text style={styles.rowText}>Remove photo</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Pressable
        testID="save-button"
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting }}
        disabled={submitting}
        onPress={save}
        style={[styles.save, submitting && styles.saveDisabled]}
      >
        <Text style={styles.saveText}>{submitting ? 'Saving...' : 'Save memory'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  back: { paddingTop: 32, paddingBottom: 8 },
  backText: { color: colors.accent, fontSize: 16 },
  input: {
    minHeight: 140,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  counter: { color: colors.textSecondary, alignSelf: 'flex-end', marginTop: 4, marginBottom: 12 },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 12 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentOn: { backgroundColor: colors.elevated },
  segmentText: { color: colors.textSecondary },
  segmentTextOn: { color: colors.text, fontWeight: '600' },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  rowText: { color: colors.accent, fontSize: 16 },
  ok: { color: colors.gold, marginBottom: 8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.elevated },
  error: { color: '#F85149', marginVertical: 8 },
  save: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: colors.background, fontSize: 16, fontWeight: '600' },
});
