import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TIMEOUT_ERROR } from '@/data/errors';
import { useSession } from '@/features/auth/useSession';
import { useAuthorNames } from '@/features/people/useAuthorNames';
import { useBlocks } from '@/features/safety/useBlocks';
import { useServices } from '@/services/ServicesProvider';
import { privacyLabel } from '@/ui/privacyLabel';
import { colors } from '@/ui/theme';

import { TimeoutError, withTimeout } from './submitMemory';
import { useMemory } from './useMemory';
import { VoiceNotePlayer } from './VoiceNotePlayer';

const DELETE_FAILED = "Couldn't delete this memory. Try again.";

export function MemoryDetailScreen({ memoryId }: { memoryId: string }) {
  const router = useRouter();
  const { repos, now } = useServices();
  const { session } = useSession();
  const { status, memory, reload } = useMemory(memoryId);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const focusedOnce = useRef(false);
  const blocked = useBlocks();
  const authorIds = useMemo(() => (memory ? [memory.userId] : []), [memory]);
  const names = useAuthorNames(authorIds);

  // Refetch when returning to this screen (e.g. from Edit); the first focus is covered by the mount fetch.
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) reload();
      focusedOnce.current = true;
    }, [reload]),
  );

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
      <Text style={styles.backText}>{'< Back'}</Text>
    </Pressable>
  );

  // ADR-0008: memories by people you blocked are hidden everywhere, including by direct link.
  const hiddenByBlock = memory !== null && memory.userId !== session?.userId && blocked.has(memory.userId);
  if (!memory || hiddenByBlock) {
    return (
      <View style={styles.container}>
        {back}
        <View style={styles.center}>
          {status === 'notFound' || hiddenByBlock ? (
            <Text style={styles.message}>This memory is no longer available.</Text>
          ) : null}
          {status === 'error' ? <Text style={styles.message}>{"Couldn't load this memory."}</Text> : null}
        </View>
      </View>
    );
  }

  const badge = privacyLabel(memory);
  const isAuthor = session?.userId === memory.userId;
  const authorName = names.get(memory.userId);

  const confirmDelete = () => {
    Alert.alert('Delete this memory?', 'You can restore it from Recently deleted for 30 days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (deletingRef.current) return;
          deletingRef.current = true;
          setDeleting(true);
          setError(null);
          try {
            await withTimeout(repos.memories.softDelete(memory.id, now()));
            router.back();
          } catch (e) {
            deletingRef.current = false;
            setDeleting(false);
            setError(e instanceof TimeoutError ? TIMEOUT_ERROR : DELETE_FAILED);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {back}
      <ScrollView contentContainerStyle={styles.content}>
        {memory.imageUrl ? <Image source={{ uri: memory.imageUrl }} style={styles.image} /> : null}
        {authorName ? <Text style={styles.author}>{authorName}</Text> : null}
        <Text style={styles.text}>{memory.textContent}</Text>
        {memory.audioUrl ? <VoiceNotePlayer url={memory.audioUrl} /> : null}
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{memory.createdAt.toLocaleString()}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {isAuthor ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/memory/${memory.id}/edit`)}
              style={styles.action}
            >
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={confirmDelete}
              style={[styles.action, deleting && styles.disabled]}
            >
              <Text style={[styles.actionText, styles.destructive]}>Delete</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { color: colors.textSecondary, textAlign: 'center', padding: 16 },
  back: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { color: colors.accent, fontSize: 16 },
  content: { padding: 16 },
  image: { width: '100%', height: 240, borderRadius: 12, marginBottom: 16 },
  author: { color: colors.gold, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  text: { color: colors.text, fontSize: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  meta: { color: colors.textSecondary },
  badge: { backgroundColor: colors.elevated, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.gold, fontSize: 12 },
  error: { color: colors.danger, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  action: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  actionText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  destructive: { color: colors.danger },
  disabled: { opacity: 0.5 },
});
