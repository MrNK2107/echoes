import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Memory } from '@/domain/types';
import { privacyLabel } from '@/ui/privacyLabel';
import { colors } from '@/ui/theme';

/** `authorName` comes from the list's useAuthorNames, so cards share one batched lookup. */
export function MemoryCard({ memory, authorName }: { memory: Memory; authorName?: string }) {
  const router = useRouter();
  const badge = privacyLabel(memory);
  return (
    <Pressable
      accessibilityRole="button"
      testID={`memory-${memory.id}`}
      style={styles.card}
      onPress={() => router.push(`/memory/${memory.id}` as never)}
    >
      {memory.imageUrl ? <Image source={{ uri: memory.imageUrl }} style={styles.image} /> : null}
      {authorName ? <Text style={styles.author}>{authorName}</Text> : null}
      <Text style={styles.text}>{memory.textContent}</Text>
      {memory.audioUrl ? <Text style={styles.voice}>Voice note</Text> : null}
      {/* Only the author can still read a hidden memory, so only they see this. */}
      {memory.moderation === 'hidden' ? <Text style={styles.hidden}>Hidden after reports</Text> : null}
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{memory.createdAt.toLocaleDateString()}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 },
  image: { width: '100%', height: 180, borderRadius: 8, marginBottom: 12 },
  author: { color: colors.gold, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  text: { color: colors.text, fontSize: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  voice: { color: colors.accent, fontSize: 12, marginTop: 8 },
  hidden: { color: colors.danger, fontSize: 12, marginTop: 8 },
  meta: { color: colors.textSecondary },
  badge: { backgroundColor: colors.elevated, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.gold, fontSize: 12 },
});
