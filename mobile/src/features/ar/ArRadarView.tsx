import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { formatDistance } from '@/ui/format';
import { colors } from '@/ui/theme';

import { AR_RADIUS_METERS, type ArPlace } from './useArScene';

const RINGS = [250, 500, 1000];
const PAD = 24;
const rad = (d: number) => (d * Math.PI) / 180;
const auraPixels = (auraRadius: number) => 6 + ((auraRadius - 1.8) / 3.2) * 14;

export function ArRadarView({
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
  const radius = c - PAD;
  // Heading up: a place at the heading's bearing sits straight above the centre.
  const at = (distance: number, bearing: number) => {
    const r = (Math.min(distance, AR_RADIUS_METERS) / AR_RADIUS_METERS) * radius;
    const a = rad(bearing - heading);
    return { x: c + r * Math.sin(a), y: c - r * Math.cos(a) };
  };

  return (
    <View style={[styles.radar, { width: size, height: size }]}>
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
        {places.map((p) => {
          const pos = at(p.distanceMeters, p.bearingDegrees);
          return (
            <Circle
              key={p.placeId}
              cx={pos.x}
              cy={pos.y}
              r={auraPixels(p.auraRadius)}
              fill={p.color}
              fillOpacity={Math.min(1, p.auraOpacity + 0.3)}
            />
          );
        })}
      </Svg>
      {RINGS.map((m) => (
        <Text key={m} style={[styles.ringLabel, { left: c + 4, top: c - (m / AR_RADIUS_METERS) * radius - 14 }]}>
          {m < 1000 ? `${m} m` : `${m / 1000} km`}
        </Text>
      ))}
      {places.map((p) => {
        const pos = at(p.distanceMeters, p.bearingDegrees);
        const orbRing = auraPixels(p.auraRadius) + 14;
        return (
          <View key={p.placeId} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <Pressable
              testID={`radar-place-${p.placeId}`}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, ${formatDistance(p.distanceMeters)}`}
              onPress={() => onPressPlace(p.placeId)}
              style={[styles.placeTarget, { left: pos.x - 22, top: pos.y - 22 }]}
            />
            {p.orbs.map((orb, i) => {
              const a = rad((360 / p.orbs.length) * i);
              return (
                <Pressable
                  key={orb.id}
                  testID={`radar-orb-${orb.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Memory: ${orb.text.slice(0, 40)}`}
                  hitSlop={14}
                  onPress={() => onPressOrb(orb.id)}
                  style={[
                    styles.orb,
                    { left: pos.x + orbRing * Math.sin(a) - 8, top: pos.y - orbRing * Math.cos(a) - 8, backgroundColor: p.color },
                  ]}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  radar: { alignSelf: 'center' },
  ringLabel: { position: 'absolute', color: colors.textSecondary, fontSize: 11 },
  placeTarget: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
  orb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.text,
  },
});
