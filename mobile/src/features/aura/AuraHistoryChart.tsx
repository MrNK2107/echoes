import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { AuraHistoryEntry } from '@/domain/types';
import { useServices } from '@/services/ServicesProvider';
import { CHART_AXIS_LATEST, CHART_AXIS_OLDEST } from '@/ui/copy';
import { capitalise } from '@/ui/format';
import { colors } from '@/ui/theme';

const MIN_BAR = 4;
const VIEW_W = 280;
const GAP = 4;

export function AuraHistoryChart({ placeId }: { placeId: string }) {
  const { repos } = useServices();
  const { width } = useWindowDimensions();
  const chartHeight = Math.round((Math.min(width, 520) - 32) * (9 / 16));
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
        <Svg testID="aura-chart" width="100%" height={chartHeight} viewBox={`0 0 ${VIEW_W} ${chartHeight}`} preserveAspectRatio="none">
          {entries.map((e, i) => {
            const h = Math.max(MIN_BAR, Math.min(1, Math.max(0, e.aura.intensity)) * chartHeight);
            return (
              <Rect
                key={e.id}
                testID={`aura-bar-${i}`}
                x={i * (barW + GAP)}
                y={chartHeight - h}
                width={barW}
                height={h}
                rx={2}
                fill={e.aura.colorHex}
              />
            );
          })}
        </Svg>
        <View style={styles.axis}>
          <Text style={styles.axisText}>{CHART_AXIS_OLDEST}</Text>
          <Text style={styles.axisText}>{CHART_AXIS_LATEST}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisText: { color: colors.textSecondary, fontSize: 12 },
  heading: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
});
