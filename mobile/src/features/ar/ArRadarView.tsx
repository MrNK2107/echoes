import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { formatDistance } from '@/ui/format';
import { colors } from '@/ui/theme';

import { MAX_ORB_EXTENT, ORB_DOT, PLACE_HIT, orbLabel, orbLayout, plotPosition, separateOrbs, truncateName } from './orbLayout';
import { AR_RADIUS_METERS, type ArPlace } from './useArScene';

const RINGS = [250, 500, 1000];
const NAME_WIDTH = 80;
const auraPixels = (auraRadius: number) => 6 + ((auraRadius - 1.8) / 3.2) * 14;

function ArRadarViewBase({
  places,
  heading,
  onPressPlace,
  onPressOrb,
}: {
  places: ArPlace[];
  heading: number;
  onPressPlace(placeId: string): void;
  onPressOrb(memoryId: string): void;
}) {
  const { width } = useWindowDimensions();
  const size = Math.max(240, Math.min(width, 520) - 32);
  const c = size / 2;
  const radius = c - MAX_ORB_EXTENT;
  const at = (distance: number, bearing: number) => plotPosition(size, distance, bearing, heading);
  const positions = separateOrbs(places.map((p) => at(p.distanceMeters, p.bearingDegrees)));
  const placed = places.map((p, i) => ({ p, pos: positions[i]!, aura: auraPixels(p.auraRadius) }));
  const showRingLabels = size >= 280;

  return (
    <View testID="radar" style={[styles.radar, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        {RINGS.map((m) => (
          <Circle
            key={m}
            cx={c}
            cy={c}
            r={(m / AR_RADIUS_METERS) * radius}
            stroke={colors.textSecondary}
            strokeOpacity={0.45}
            strokeWidth={1}
            fill="none"
          />
        ))}
        <Circle cx={c} cy={c} r={4} fill={colors.accent} />
        {placed.map(({ p, pos, aura }) => (
          <Circle key={p.placeId} cx={pos.x} cy={pos.y} r={aura} fill={p.color} fillOpacity={Math.min(1, p.auraOpacity + 0.3)} />
        ))}
      </Svg>
      {(showRingLabels ? RINGS : []).map((m) => (
        <Text
          key={m}
          accessible={false}
          importantForAccessibility="no"
          style={[styles.ringLabel, { left: c + 4, top: c - (m / AR_RADIUS_METERS) * radius - 14 }]}
        >
          {m < 1000 ? `${m} m` : `${m / 1000} km`}
        </Text>
      ))}
      {placed.map(({ p, pos, aura }) => (
        <Text
          key={`name-${p.placeId}`}
          accessible={false}
          importantForAccessibility="no"
          pointerEvents="none"
          numberOfLines={1}
          style={[styles.name, { left: Math.min(Math.max(pos.x - NAME_WIDTH / 2, 0), size - NAME_WIDTH), top: pos.y + aura + 2 }]}
        >
          {truncateName(p.name)}
        </Text>
      ))}
      {/* Orbs first, place targets last: the aura target stays on top wherever boxes touch. */}
      {placed.map(({ p, pos, aura }) => {
        const layout = orbLayout(aura, p.orbs.length);
        return p.orbs.map((orb, i) => {
          const o = layout.orbs[i]!;
          return (
            <Pressable
              key={orb.id}
              testID={`radar-orb-${orb.id}`}
              accessibilityRole="button"
              accessibilityLabel={orbLabel(orb)}
              onPress={() => onPressOrb(orb.id)}
              style={[
                styles.orbHit,
                { width: layout.hit, height: layout.hit, left: pos.x + o.dx - layout.hit / 2, top: pos.y + o.dy - layout.hit / 2 },
              ]}
            >
              <View style={[styles.orb, { backgroundColor: p.color }]} />
            </Pressable>
          );
        });
      })}
      {placed.map(({ p, pos }) => (
        <Pressable
          key={p.placeId}
          testID={`radar-place-${p.placeId}`}
          accessibilityRole="button"
          accessibilityLabel={`${p.name}, ${formatDistance(p.distanceMeters)}`}
          onPress={() => onPressPlace(p.placeId)}
          style={[styles.placeTarget, { left: pos.x - PLACE_HIT / 2, top: pos.y - PLACE_HIT / 2 }]}
        />
      ))}
    </View>
  );
}

export const ArRadarView = memo(ArRadarViewBase);

const styles = StyleSheet.create({
  radar: { alignSelf: 'center' },
  ringLabel: { position: 'absolute', color: colors.textSecondary, fontSize: 11 },
  name: { position: 'absolute', width: NAME_WIDTH, textAlign: 'center', color: colors.text, fontSize: 10 },
  placeTarget: { position: 'absolute', width: PLACE_HIT, height: PLACE_HIT, borderRadius: PLACE_HIT / 2 },
  orbHit: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  orb: { width: ORB_DOT, height: ORB_DOT, borderRadius: ORB_DOT / 2, borderWidth: 1, borderColor: colors.text },
});
