import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

import { distanceMeters } from '@/domain/geo';
import type { Place } from '@/domain/types';
import { InboxBell } from '@/features/inbox/InboxBell';
import { OutboxBanner } from '@/features/outbox/OutboxBanner';
import { formatCount, formatDistance } from '@/ui/format';
import { AR_BUTTON, AR_BUTTON_LABEL, LOCATION_DENIED, LOCATION_ERROR, OPEN_SETTINGS_LABEL } from '@/ui/copy';
import { CommunitiesIcon, ProfileIcon } from '@/ui/icons';
import { colors } from '@/ui/theme';

import { useNearbyPlaces } from './useNearbyPlaces';

export function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  // Below 360 effective dp (width over font scale) the pills collapse to icons; accessibility labels stay full.
  const compact = width / fontScale < 360;
  const [rowHeight, setRowHeight] = useState(44);
  const { status, center, places, retry } = useNearbyPlaces();
  const openSettings = () => {
    Linking.openSettings().catch((e: unknown) => console.warn('Could not open settings', e));
  };
  const openPlace = (id: string) => router.push(`/place/${id}`);

  const topRow = (
      <View
        testID="map-top-row"
        onLayout={(e) => setRowHeight(e.nativeEvent.layout.height)}
        style={[styles.topRow, { top: insets.top + 8 }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Communities"
          onPress={() => router.push('/communities')}
          style={[styles.pill, compact && styles.pillCompact]}
        >
          {compact ? <CommunitiesIcon /> : <Text style={styles.buttonText}>Communities</Text>}
        </Pressable>
        <View style={styles.spacer} />
        <InboxBell compact={compact} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          onPress={() => router.push('/profile')}
          style={[styles.pill, compact && styles.pillCompact]}
        >
          {compact ? <ProfileIcon /> : <Text style={styles.buttonText}>Profile</Text>}
        </Pressable>
      </View>
  );

  if (status === 'locating') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Finding your location...</Text>
      </View>
    );
  }
  if (status === 'denied' || status === 'error') {
    // The top row stays: Communities, notifications and Profile do not need location.
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.message}>{status === 'denied' ? LOCATION_DENIED : LOCATION_ERROR}</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
          {status === 'denied' ? (
            <Pressable accessibilityRole="button" onPress={openSettings} style={styles.button}>
              <Text style={styles.buttonText}>{OPEN_SETTINGS_LABEL}</Text>
            </Pressable>
          ) : null}
        </View>
        {topRow}
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
      {topRow}
      <View testID="map-banner" style={[styles.banner, { top: insets.top + 8 + rowHeight + 8 }]}>
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
        style={[styles.ar, { bottom: insets.bottom + 16 }]}
      >
        <Text style={styles.buttonText}>{AR_BUTTON}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/add-memory')}
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
      >
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
  topRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    rowGap: 8,
  },
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
    
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
  },
});
