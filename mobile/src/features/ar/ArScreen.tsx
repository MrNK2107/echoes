import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useServices } from '@/services/ServicesProvider';
import {
  AR_CAMERA_DENIED,
  AR_CAMERA_VIEW,
  AR_EMPTY,
  AR_HEADING_UNAVAILABLE,
  AR_LOADING,
  AR_RADAR_VIEW,
  AR_TRACKING_ERROR,
  AR_UNSUPPORTED,
} from '@/ui/copy';
import { Notice } from '@/ui/Notice';
import { BackButton } from '@/ui/BackButton';
import { colors } from '@/ui/theme';

import { ArRadarView } from './ArRadarView';
import { useArScene } from './useArScene';

type Capability = 'checking' | 'unsupported' | 'denied' | 'ready';

export function ArScreen() {
  const router = useRouter();
  const { arRenderer } = useServices();
  const scene = useArScene();
  const [capability, setCapability] = useState<Capability>('checking');
  const [mode, setMode] = useState<'camera' | 'radar'>('camera');
  const [trackingLost, setTrackingLost] = useState(false);
  const Scene = arRenderer.Scene;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Never prompt for the camera when AR cannot be used anyway.
        if (!Scene || (await arRenderer.status()) !== 'available') {
          if (active) setCapability('unsupported');
          return;
        }
        let camera: 'granted' | 'denied';
        try {
          camera = await arRenderer.requestCamera();
        } catch {
          camera = 'denied';
        }
        if (active) setCapability(camera === 'granted' ? 'ready' : 'denied');
      } catch {
        if (active) setCapability('unsupported');
      }
    })();
    return () => {
      active = false;
    };
  }, [arRenderer, Scene]);

  const openPlace = useCallback((id: string) => router.push(`/place/${id}`), [router]);
  const openMemory = useCallback((id: string) => router.push(`/memory/${id}`), [router]);
  // Without a compass the camera scene cannot be oriented, so it is never offered.
  const canCamera = capability === 'ready' && !!Scene && !scene.headingUnavailable;
  const showCamera = canCamera && mode === 'camera' && !trackingLost;
  // The scene latches its start heading on mount, so wait for a real compass sample.
  const awaitingHeading = showCamera && !scene.headingReady;

  const notice =
    capability === 'unsupported'
      ? AR_UNSUPPORTED
      : capability === 'denied'
        ? AR_CAMERA_DENIED
        : trackingLost
          ? AR_TRACKING_ERROR
          : null;

  const back = (
    <BackButton />
  );

  let body;
  if (scene.status === 'locating' || capability === 'checking' || (awaitingHeading && scene.places.length > 0)) {
    body = <ActivityIndicator style={styles.spinner} color={colors.accent} accessibilityLabel={AR_LOADING} />;
  } else if (scene.status === 'denied' || scene.status === 'error') {
    body = (
      <View style={styles.center}>
        <Text style={styles.message}>Could not get your location.</Text>
        <Pressable accessibilityRole="button" onPress={scene.retry} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (scene.places.length === 0) {
    body = <Text style={styles.message}>{AR_EMPTY}</Text>;
  } else if (showCamera && Scene) {
    body = (
      <Scene
        places={scene.places}
        heading={scene.heading}
        onPressPlace={openPlace}
        onPressOrb={openMemory}
        onTrackingError={() => setTrackingLost(true)}
      />
    );
  } else {
    body = (
      <>
        <Notice message={scene.headingUnavailable ? AR_HEADING_UNAVAILABLE : null} style={styles.message} />
        <ArRadarView
          places={scene.places}
          heading={scene.headingUnavailable ? 0 : scene.heading}
          onPressPlace={openPlace}
          onPressOrb={openMemory}
        />
      </>
    );
  }

  return (
    <View style={styles.container}>
      {back}
      <Notice message={scene.places.length > 0 ? notice : null} style={styles.message} />
      {canCamera && scene.places.length > 0 && !trackingLost ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setMode(mode === 'camera' ? 'radar' : 'camera')}
          style={styles.toggle}
        >
          <Text style={styles.buttonText}>{mode === 'camera' ? AR_RADAR_VIEW : AR_CAMERA_VIEW}</Text>
        </Pressable>
      ) : null}
      <View style={styles.body}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center', padding: 24 },
  spinner: { alignSelf: 'center' },
  message: { color: colors.textSecondary, textAlign: 'center', padding: 16 },
  button: { backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, marginTop: 12 },
  buttonText: { color: colors.background, fontWeight: '600' },
  toggle: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
});
