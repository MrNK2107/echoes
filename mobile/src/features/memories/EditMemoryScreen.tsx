import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { GENERIC_ERROR, TIMEOUT_ERROR } from '@/data/errors';
import { normalizePrivacyFields, validateMemoryText } from '@/domain/memoryLifecycle';
import { validatePrivacy } from '@/domain/privacy';
import { analyzeSentiment } from '@/domain/sentiment';
import type { Memory, PrivacyType } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';
import { Notice } from '@/ui/Notice';
import { BackButton } from '@/ui/BackButton';
import { colors } from '@/ui/theme';

import { PrivacyPicker } from './PrivacyPicker';
import { askBeforeSavingProfanity } from './profanityCheck';
import { MAX_MEMORY_LENGTH, TimeoutError, withTimeout } from './submitMemory';
import { useMemory } from './useMemory';

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

/** testIDs: text-input, privacy-{value}, release-date-button, community-{id}, chip-{uid}, save-button, back-button */
function EditForm({ memory }: { memory: Memory }) {
  const router = useRouter();
  const { repos, now } = useServices();
  const [text, setText] = useState(memory.textContent);
  const [privacy, setPrivacy] = useState<PrivacyType>(memory.privacy);
  const [releaseDate, setReleaseDate] = useState<Date | null>(memory.releaseDate);
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>(memory.taggedUserIds);
  const [communityId, setCommunityId] = useState<string | null>(memory.communityId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  /** The latest update, kept while it may still be running after a timeout so a newer save is ordered after it. */
  const lastWrite = useRef<Promise<unknown> | null>(null);

  const settle = (w: Promise<unknown>) => {
    if (lastWrite.current === w) lastWrite.current = null;
  };

  const save = async (confirmed = false): Promise<void> => {
    if (busy.current) return;
    setError(null);
    const textError = validateMemoryText(text);
    if (textError) return setError(textError);
    const at = now();
    const fields = { privacy, taggedUserIds, releaseDate, communityId };
    // A released time-release memory keeps its past date; only changed privacy fields are re-validated.
    const privacyChanged =
      privacy !== memory.privacy ||
      releaseDate?.getTime() !== memory.releaseDate?.getTime() ||
      communityId !== memory.communityId ||
      taggedUserIds.length !== memory.taggedUserIds.length ||
      taggedUserIds.some((id, i) => id !== memory.taggedUserIds[i]);
    const privacyError = privacyChanged ? validatePrivacy({ ...fields, now: at }) : null;
    if (privacyError) return setError(privacyError);
    // Only new wording is checked: an unchanged text was already confirmed when it was saved.
    const textChanged = text.trim() !== memory.textContent;
    if (!confirmed && textChanged && askBeforeSavingProfanity(text, () => void save(true))) return;

    busy.current = true;
    setSaving(true);
    let done = false;
    try {
      const trimmed = text.trim();
      const previous = lastWrite.current;
      const write = (async () => {
        await previous?.catch(() => {});
        await repos.memories.update(
          memory.id,
          { textContent: trimmed, sentiment: analyzeSentiment(trimmed), ...normalizePrivacyFields(fields) },
          at,
        );
      })();
      lastWrite.current = write;
      void write.then(
        () => settle(write),
        () => settle(write),
      );
      await withTimeout(write);
      done = true;
      router.back();
    } catch (e) {
      setError(e instanceof TimeoutError ? TIMEOUT_ERROR : GENERIC_ERROR);
    } finally {
      busy.current = false;
      if (!done) setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BackButton />
      <Text accessibilityRole="header" style={styles.title}>
        Edit memory
      </Text>
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
        taggedUserIds={taggedUserIds}
        onTaggedUserIdsChange={setTaggedUserIds}
        communityId={communityId}
        onCommunityChange={setCommunityId}
        now={now()}
      />

      <Notice tone="error" message={error} style={styles.error} />

      <Pressable
        testID="save-button"
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        onPress={() => save()}
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
  error: { color: colors.danger, marginVertical: 8 },
  save: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: colors.background, fontSize: 16, fontWeight: '600' },
});
