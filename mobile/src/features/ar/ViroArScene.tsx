import React, { useEffect, useMemo, useRef } from "react";
import type { ComponentType } from "react";

import { rotateByHeading } from "@/domain/arScene";
import type { ArSceneProps } from "@/device/types";

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
const ORB_MATERIAL = "echoes-orb";

const materialName = (color: string): string => `echoes-aura-${color}`;

export function createViroArScene(viro: ViroApi): ComponentType<ArSceneProps> {
  const {
    ViroARSceneNavigator,
    ViroARScene,
    ViroSphere,
    ViroMaterials,
    ViroTrackingStateConstants,
  } = viro;
  const registered = new Set<string>();

  function ensureMaterials(colors: string[]): void {
    const fresh: Record<string, { diffuseColor: string }> = {};
    if (!registered.has(ORB_MATERIAL)) {
      registered.add(ORB_MATERIAL);
      fresh[ORB_MATERIAL] = { diffuseColor: "#ffffff" };
    }
    for (const c of colors) {
      const name = materialName(c);
      if (registered.has(name)) continue;
      registered.add(name);
      fresh[name] = { diffuseColor: c };
    }
    if (Object.keys(fresh).length > 0) ViroMaterials.createMaterials(fresh);
  }

  return function ViroArSceneView(props: ArSceneProps) {
    const latest = useRef(props);
    latest.current = props;
    const startHeading = useRef(props.heading);
    const errored = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    ensureMaterials(props.places.map((p) => p.color));

    useEffect(
      () => () => {
        if (timer.current) clearTimeout(timer.current);
      },
      [],
    );

    const Scene = useMemo(() => {
      const fail = () => {
        if (errored.current) return;
        errored.current = true;
        if (timer.current) clearTimeout(timer.current);
        latest.current.onTrackingError();
      };
      const onTrackingUpdated = (state: number) => {
        if (errored.current) return;
        if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
        } else if (state === ViroTrackingStateConstants.TRACKING_UNAVAILABLE) {
          fail();
        } else if (!timer.current) {
          timer.current = setTimeout(fail, TRACKING_GRACE_MS);
        }
      };
      return function ArSceneContent() {
        const { places, onPressPlace, onPressOrb } = latest.current;
        return (
          <ViroARScene onTrackingUpdated={onTrackingUpdated}>
            {places.map((place) => {
              const { x, z } = rotateByHeading(place, startHeading.current);
              const orbCount = Math.min(
                place.visibleOrbCount,
                place.memoryIds.length,
              );
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
                        position={[
                          x + ringRadius * Math.cos(angle),
                          SCENE_Y,
                          z + ringRadius * Math.sin(angle),
                        ]}
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
    }, []);

    return (
      <ViroARSceneNavigator
        initialScene={{ scene: Scene }}
        autofocus
        style={{ flex: 1 }}
      />
    );
  };
}
