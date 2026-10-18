import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { normalizePrivacyFields, validateMemoryText } from '@/domain/memoryLifecycle';
import { validatePrivacy } from '@/domain/privacy';
import type { Memory, PrivacyType } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

import { PrivacyPicker } from './PrivacyPicker';
import { MAX_MEMORY_LENGTH, TimeoutError, withTimeout } from './submitMemory';
import { useMemory } from './useMemory';

const TIMEOUT_COPY = 'Could not reach the server. Check your connection and try again.';
const GENERIC_COPY = 'Something went wrong. Please try again.';

/** Only the author may edit; anyone else is sent back without seeing the form. */
export function EditMemoryScreen({ memoryId }: { memoryId: string }) {
  const router = useRouter();
  const { session } = useSession();
  const { status, memory } = useMemory(memoryId);
  const allowed = memory !== null && session?.userId === memory.userId;
  const leave = (memory !== null && !allowed) || status === 'notFound' || status === 'error';

  useEffect(() => {
    if (leave) router.back();
  }, [leave, router]);

  if (!memory || !allowed) {
    return (
      <View style={[styles.container, styles.center]}>
        {leave ? null : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }
  return <EditForm memory={memory} />;
}

/** testIDs: text-input, privacy-{value}, release-date-button, save-button, back-button */
function EditForm({ memory }: { memory: Memory }) {
  const router = useRouter();
  const { repos, now } = useServices();
  const [text, setText] = useState(memory.textContent);
  const [privacy, setPrivacy] = useState<PrivacyType>(memory.privacy);
  const [releaseDate, setReleaseDate] = useState<Date | null>(memory.releaseDate);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const save = async () => {
    if (busy.current) return;
    setError(null);
    const textError = validateMemoryText(text);
    if (textError) return setError(textError);
    const at = now();
    const fields = { privacy, taggedUserIds: memory.taggedUserIds, releaseDate, communityId: memory.communityId };
    const privacyError = validatePrivacy({ ...fields, now: at });
    if (privacyError) return setError(privacyError);

    busy.current = true;
    setSaving(true);
    let done = false;
    try {
      await withTimeout(
        repos.memories.update(memory.id, { textContent: text.trim(), ...normalizePrivacyFields(fields) }, at),
      );
      done = true;
      router.back();
    } catch (e) {
      setError(e instanceof TimeoutError ? TIMEOUT_COPY : GENERIC_COPY);
    } finally {
      busy.current = false;
      if (!done) setSaving(false);
    }
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
      <Text style={styles.title}>Edit memory</Text>
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
        onPrivacyChange={setPrivacy}
        releaseDate={releaseDate}
        onReleaseDateChange={setReleaseDate}
        now={now()}
      />

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Pressable
        testID="save-button"
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        onPress={save}
        style={[styles.save, saving && styles.saveDisabled]}
      >
        <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save changes'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48 },
  back: { paddingTop: 32, paddingBottom: 8 },
  backText: { color: colors.accent, fontSize: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '600', marginBottom: 12 },
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
  error: { color: '#F85149', marginVertical: 8 },
  save: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: colors.background, fontSize: 16, fontWeight: '600' },
});
