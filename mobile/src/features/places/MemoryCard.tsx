import { Image, StyleSheet, Text, View } from 'react-native';

import type { Memory, PrivacyType } from '@/domain/types';
import { colors } from '@/ui/theme';

const BADGES: Partial<Record<PrivacyType, string>> = {
  private: 'Private',
  tagged: 'Tagged',
  timeRelease: 'Time release',
  community: 'Community',
};

export function MemoryCard({ memory }: { memory: Memory }) {
  const badge = BADGES[memory.privacy];
  return (
    <View testID={`memory-${memory.id}`} style={styles.card}>
      {memory.imageUrl ? <Image source={{ uri: memory.imageUrl }} style={styles.image} /> : null}
      <Text style={styles.text}>{memory.textContent}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{memory.createdAt.toLocaleDateString()}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 },
  image: { width: '100%', height: 180, borderRadius: 8, marginBottom: 12 },
  text: { color: colors.text, fontSize: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  meta: { color: colors.textSecondary },
  badge: { backgroundColor: colors.elevated, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.gold, fontSize: 12 },
});
