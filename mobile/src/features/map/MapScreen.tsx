import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

import { distanceMeters } from '@/domain/geo';
import type { Place } from '@/domain/types';
import { InboxBell } from '@/features/inbox/InboxBell';
import { OutboxBanner } from '@/features/outbox/OutboxBanner';
import { formatCount, formatDistance } from '@/ui/format';
import { AR_BUTTON, AR_BUTTON_LABEL, MAP_COMMUNITIES_SHORT, MAP_PROFILE_SHORT } from '@/ui/copy';
import { colors } from '@/ui/theme';

import { useNearbyPlaces } from './useNearbyPlaces';

export function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  // Below 360dp or at large font scales the pills collapse to short labels; accessibility labels stay full.
  const compact = width < 360 || fontScale > 1.3;
  const { status, center, places, retry } = useNearbyPlaces();
  const openPlace = (id: string) => router.push(`/place/${id}`);

  if (status === 'locating') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Finding your location...</Text>
      </View>
    );
  }
  if (status === 'denied' || status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          {status === 'denied'
            ? 'Location permission is needed to find memories near you.'
            : "Couldn't get your location."}
        </Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const region = center && {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region ?? undefined} showsUserLocation>
        {places.map((p: Place) => (
          <Marker
            key={p.id}
            testID={`marker-${p.id}`}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            pinColor={p.aura.colorHex}
            title={p.name}
            onPress={() => openPlace(p.id)}
          />
        ))}
      </MapView>
      <View testID="map-top-row" style={[styles.topRow, { top: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Communities"
          onPress={() => router.push('/communities')}
          style={[styles.pill, compact && styles.pillCompact]}
        >
          <Text style={styles.buttonText}>{compact ? MAP_COMMUNITIES_SHORT : 'Communities'}</Text>
        </Pressable>
        <View style={styles.spacer} />
        <InboxBell />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          onPress={() => router.push('/profile')}
          style={[styles.pill, compact && styles.pillCompact]}
        >
          <Text style={styles.buttonText}>{compact ? MAP_PROFILE_SHORT : 'Profile'}</Text>
        </Pressable>
      </View>
      <View style={[styles.banner, { top: insets.top + 64 }]}>
        <OutboxBanner />
      </View>
      <FlatList
        style={styles.list}
        data={places}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={
          <Text style={styles.message}>No memories within 1.5 km yet. Be the first to leave one.</Text>
        }
        renderItem={({ item }) => (
          <Pressable testID={`place-row-${item.id}`} onPress={() => openPlace(item.id)} style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{formatCount(item.memoryCount)}</Text>
              {center ? <Text style={styles.meta}>{formatDistance(distanceMeters(center, item))}</Text> : null}
            </View>
          </Pressable>
        )}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={AR_BUTTON_LABEL}
        onPress={() => router.push('/ar')}
        style={styles.ar}
      >
        <Text style={styles.buttonText}>{AR_BUTTON}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/add-memory')} style={styles.fab}>
        <Text style={styles.buttonText}>Add memory</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  map: { flex: 1 },
  banner: { position: 'absolute', left: 16, right: 16 },
  topRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  spacer: { flex: 1 },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  pillCompact: { minWidth: 44, alignItems: 'center', paddingHorizontal: 12 },
  list: { flex: 1, backgroundColor: colors.surface },
  row: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.elevated },
  name: { color: colors.text, fontSize: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  meta: { color: colors.textSecondary },
  message: { color: colors.textSecondary, textAlign: 'center', padding: 16 },
  button: { backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, marginTop: 12 },
  buttonText: { color: colors.background, fontWeight: '600' },
  ar: {
    position: 'absolute',
    left: 16,
    bottom: 24,
    minWidth: 56,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    borderRadius: 28,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
  },
});
