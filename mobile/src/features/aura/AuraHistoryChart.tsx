import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { AuraHistoryEntry } from '@/domain/types';
import { useServices } from '@/services/ServicesProvider';
import { capitalise } from '@/ui/format';
import { colors } from '@/ui/theme';

const HEIGHT = 80;
const MIN_BAR = 4;
const VIEW_W = 280;
const GAP = 4;

export function AuraHistoryChart({ placeId }: { placeId: string }) {
  const { repos } = useServices();
  const [entries, setEntries] = useState<AuraHistoryEntry[]>([]);

  useEffect(() => {
    return repos.places.subscribeAuraHistory(
      placeId,
      (e) => setEntries(e),
      () => setEntries([]), // history is decorative: fail silently
    );
  }, [repos, placeId]);

  if (entries.length < 2) return null;

  const first = entries[0]!;
  const last = entries[entries.length - 1]!;
  const barW = (VIEW_W - GAP * (entries.length - 1)) / entries.length;
  const label = `Aura history: ${capitalise(first.aura.dominantSentiment)} to ${capitalise(last.aura.dominantSentiment)} over ${entries.length} updates`;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Aura history</Text>
      <View accessible accessibilityRole="image" accessibilityLabel={label}>
        <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${VIEW_W} ${HEIGHT}`} preserveAspectRatio="none">
          {entries.map((e, i) => {
            const h = Math.max(MIN_BAR, Math.min(1, Math.max(0, e.aura.intensity)) * HEIGHT);
            return (
              <Rect
                key={e.id}
                testID={`aura-bar-${i}`}
                x={i * (barW + GAP)}
                y={HEIGHT - h}
                width={barW}
                height={h}
                rx={2}
                fill={e.aura.colorHex}
              />
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  heading: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
});
