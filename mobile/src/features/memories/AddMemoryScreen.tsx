import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { LatLng } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useOutboxContext } from '@/features/outbox/useOutbox';
import { useServices } from '@/services/ServicesProvider';
import { LOCATION_FAILED } from '@/ui/copy';
import { Notice } from '@/ui/Notice';
import { BackButton } from '@/ui/BackButton';
import { colors } from '@/ui/theme';

import { PrivacyPicker, type PrivacyChoice } from './PrivacyPicker';
import { askBeforeSavingProfanity } from './profanityCheck';
import { MAX_MEMORY_LENGTH, submitMemory, validateDraft, type MemoryDraft } from './submitMemory';
import { VoiceRecorder } from './VoiceRecorder';

const PERMISSION_COPY = 'Location permission is needed to save a memory here.';
const QUEUED_COPY = "Saved offline. It will upload when you're back online.";
/** How long the queued notice stays up before returning to the map. */
export const QUEUED_NOTICE_MS = 2_500;

/** testIDs: text-input, privacy-{value}, release-date-button, community-{id}, chip-{uid}, use-location-button, add-photo-button, photo-thumbnail, save-button, back-button */
export function AddMemoryScreen() {
  const router = useRouter();
  const services = useServices();
  const { session } = useSession();
  const [text, setText] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyChoice>('private');
  const [defaultResolved, setDefaultResolved] = useState(false);
  const [releaseDate, setReleaseDate] = useState<Date | null>(null);
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [queued, setQueued] = useState(false);
  const { outbox } = useOutboxContext();
  // Guards against a double tap starting two submits; offline retries belong to the outbox (ADR-0006).
  const saving = useRef(false);

  // Never default to public before the user's preference is known: the picker starts on 'private',
  // Save stays disabled until the default resolves (or the user picks explicitly), and a failed or
  // missing lookup stays 'private'. A choice the user already made is never overwritten.
  const privacyTouched = useRef(false);
  const [touched, setTouched] = useState(false);
  const uid = session?.userId;
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    services.repos.users
      .get(uid)
      .then((u) => {
        if (cancelled) return;
        if (!privacyTouched.current && u?.defaultPrivacy === 'public') setPrivacy('public');
        setDefaultResolved(true);
      })
      .catch(() => {
        if (!cancelled) setDefaultResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [services.repos.users, uid]);

  useEffect(() => {
    if (!queued) return;
    const timer = setTimeout(() => router.replace('/'), QUEUED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [queued, router]);

  const captureLocation = async () => {
    setError(null);
    try {
      if ((await services.location.requestPermission()) !== 'granted') {
        setError(PERMISSION_COPY);
        return;
      }
      setLocation(await services.location.getCurrentPosition());
    } catch {
      setError(LOCATION_FAILED);
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

  const canSave = defaultResolved || touched;

  const save = async (confirmed = false): Promise<void> => {
    if (!session || saving.current || queued || !canSave) return;
    const draft: MemoryDraft = {
      textContent: text,
      privacy,
      releaseDate: privacy === 'timeRelease' ? releaseDate : null,
      taggedUserIds: privacy === 'tagged' ? taggedUserIds : [],
      communityId: privacy === 'community' ? communityId : null,
      location,
      imageUri,
      audioUri,
    };
    // The form's own errors come first; the wording question only makes sense for a savable draft.
    const invalid = validateDraft(draft, services.now());
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!confirmed && askBeforeSavingProfanity(text, () => void save(true))) return;
    saving.current = true;
    setError(null);
    setSubmitting(true);
    let done = false;
    try {
      const result = await submitMemory(services, session.userId, draft, outbox);
      if (!result.ok) setError(result.error);
      else if (result.queued) {
        done = true;
        setQueued(true);
      } else {
        done = true;
        router.replace(`/place/${result.placeId}`);
      }
    } finally {
      saving.current = false;
      if (!done) setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BackButton />
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

      <PrivacyPicker
        privacy={privacy}
        onPrivacyChange={(p) => {
          privacyTouched.current = true;
          setTouched(true);
          setPrivacy(p);
        }}
        releaseDate={releaseDate}
        onReleaseDateChange={setReleaseDate}
        taggedUserIds={taggedUserIds}
        onTaggedUserIdsChange={setTaggedUserIds}
        communityId={communityId}
        onCommunityChange={setCommunityId}
        now={services.now()}
      />

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

      <VoiceRecorder onChange={(r) => setAudioUri(r ? r.uri : null)} />

      <Notice message={queued ? QUEUED_COPY : null} style={styles.notice} />
      <Notice tone="error" message={error} style={styles.error} />

      <Pressable
        testID="save-button"
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting || !canSave }}
        disabled={submitting || !canSave}
        onPress={() => save()}
        style={[styles.save, (submitting || !canSave) && styles.saveDisabled]}
      >
        <Text style={styles.saveText}>{submitting ? 'Saving...' : 'Save memory'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
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
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  rowText: { color: colors.accent, fontSize: 16 },
  ok: { color: colors.gold, marginBottom: 8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.elevated },
  error: { color: colors.danger, marginVertical: 8 },
  notice: { color: colors.gold, marginVertical: 8 },
  save: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: colors.background, fontSize: 16, fontWeight: '600' },
});
