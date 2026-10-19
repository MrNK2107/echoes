import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ComponentType } from 'react';

import { rotateByHeading } from '@/domain/arScene';
import type { ArSceneProps } from '@/device/types';

/**
 * Minimal surface of `@reactvision/react-viro` used here. Shapes follow the
 * documented ViroReact API but are UNVERIFIED against a real install (the
 * package is not yet a dependency; see ruling R-P4-9).
 */
export interface ViroApi {
  ViroARSceneNavigator: ComponentType<{
    initialScene: { scene: ComponentType<object> };
    autofocus?: boolean;
    style?: object;
  }>;
  ViroARScene: ComponentType<{
    onTrackingUpdated?: (state: number, reason: number) => void;
    children?: React.ReactNode;
  }>;
  ViroSphere: ComponentType<{
    position: [number, number, number];
    radius: number;
    materials?: string[];
    opacity?: number;
    onClick?: () => void;
  }>;
  ViroMaterials: {
    createMaterials(materials: Record<string, { diffuseColor: string }>): void;
  };
  ViroTrackingStateConstants: {
    TRACKING_UNAVAILABLE: number;
    TRACKING_NORMAL: number;
    TRACKING_LIMITED?: number;
  };
}

const ORB_RADIUS = 0.15;
const ORB_RING_OFFSET = 0.6;
const SCENE_Y = -1;
const TRACKING_GRACE_MS = 5000;
const ORB_MATERIAL = 'echoes-orb';

const materialName = (color: string): string => `echoes-aura-${color.toLowerCase()}`;

function createStore(initial: ArSceneProps) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: ArSceneProps) {
      if (next === value) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export function createViroArScene(viro: ViroApi): ComponentType<ArSceneProps> {
  const { ViroARSceneNavigator, ViroARScene, ViroSphere, ViroMaterials, ViroTrackingStateConstants } = viro;
  const registered = new Set<string>();

  function ensureMaterials(colors: string[]): void {
    const fresh: Record<string, { diffuseColor: string }> = {};
    if (!registered.has(ORB_MATERIAL)) {
      registered.add(ORB_MATERIAL);
      fresh[ORB_MATERIAL] = { diffuseColor: '#ffffff' };
    }
    for (const c of colors) {
      const name = materialName(c);
      if (registered.has(name)) continue;
      registered.add(name);
      fresh[name] = { diffuseColor: c.toLowerCase() };
    }
    if (Object.keys(fresh).length > 0) ViroMaterials.createMaterials(fresh);
  }

  return function ViroArSceneView(props: ArSceneProps) {
    // The navigator keeps `initialScene` as its own state and never re-renders it for parent renders,
    // so the scene subscribes to a per-instance store instead of closing over props.
    const [store] = useState(() => createStore(props));
    // Latched once for the whole session; ArScreen only mounts the scene after a real compass sample.
    const startHeading = useRef(props.heading);
    const errored = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    ensureMaterials(props.places.map((p) => p.color));

    useEffect(() => {
      store.set(props);
    });

    useEffect(
      () => () => {
        if (timer.current) clearTimeout(timer.current);
      },
      [],
    );

    const [Scene] = useState(() => {
      const fail = () => {
        if (errored.current) return;
        errored.current = true;
        store.get().onTrackingError();
      };
      const onTrackingUpdated = (state: number) => {
        if (errored.current) return;
        if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
        } else if (!timer.current) {
          // UNAVAILABLE and LIMITED both get a grace period: ARCore reports a brief UNAVAILABLE at session start.
          timer.current = setTimeout(fail, TRACKING_GRACE_MS);
        }
      };
      return function ArSceneContent() {
        const { places, onPressPlace, onPressOrb } = useSyncExternalStore(store.subscribe, store.get);
        return (
          <ViroARScene onTrackingUpdated={onTrackingUpdated}>
            {places.map((place) => {
              const { x, z } = rotateByHeading(place, startHeading.current);
              const orbCount = Math.min(place.visibleOrbCount, place.memoryIds.length);
              const ringRadius = place.auraRadius + ORB_RING_OFFSET;
              return (
                <React.Fragment key={place.placeId}>
                  <ViroSphere
                    position={[x, SCENE_Y, z]}
                    radius={place.auraRadius}
                    materials={[materialName(place.color)]}
                    opacity={place.auraOpacity}
                    onClick={() => onPressPlace(place.placeId)}
                  />
                  {place.memoryIds.slice(0, orbCount).map((memoryId, i) => {
                    const angle = (2 * Math.PI * i) / orbCount;
                    return (
                      <ViroSphere
                        key={memoryId}
                        position={[x + ringRadius * Math.cos(angle), SCENE_Y, z + ringRadius * Math.sin(angle)]}
                        radius={ORB_RADIUS}
                        materials={[ORB_MATERIAL]}
                        onClick={() => onPressOrb(memoryId)}
                      />
                    );
                  })}
                </React.Fragment>
              );
            })}
          </ViroARScene>
        );
      };
    });

    return <ViroARSceneNavigator initialScene={{ scene: Scene }} autofocus style={{ flex: 1 }} />;
  };
}
