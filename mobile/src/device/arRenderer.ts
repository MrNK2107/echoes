import type { ComponentType } from "react";
import * as ImagePicker from "expo-image-picker";

import { createViroArScene, type ViroApi } from "@/features/ar/ViroArScene";

import type { ArRenderer, ArSceneProps, ArStatus } from "./types";

interface ViroModule extends Partial<ViroApi> {
  ViroUtils?: {
    isARSupportedOnDevice?: (
      notSupported: (reason?: string) => void,
      supported: () => void,
    ) => unknown;
  };
}

/** Optional native dependency: absent in Expo Go and until the dev build adds it. */
function loadViro(): ViroModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native dep, must be lazy
    return require("@reactvision/react-viro") as ViroModule;
  } catch {
    return null;
  }
}

let sceneMemo: ComponentType<ArSceneProps> | null | undefined;

export const expoArRenderer: ArRenderer = {
  async status(): Promise<ArStatus> {
    const viro = loadViro();
    if (!viro) return "missing";
    const check = viro.ViroUtils?.isARSupportedOnDevice;
    if (typeof check !== "function") return "available";
    return new Promise<ArStatus>((resolve) => {
      const timer = setTimeout(() => resolve("unsupported"), 3000);
      const done = (status: ArStatus) => {
        clearTimeout(timer);
        resolve(status);
      };
      const fromValue = (v: unknown) => done(v ? "available" : "unsupported");
      try {
        // ViroReact: isARSupportedOnDevice(notSupportedCallback, supportedCallback).
        const ret: unknown = check(
          () => done("unsupported"),
          () => done("available"),
        );
        if (typeof ret === "boolean") fromValue(ret);
        else if (ret && typeof (ret as Promise<unknown>).then === "function") {
          (ret as Promise<unknown>).then(fromValue, () => done("unsupported"));
        }
      } catch {
        done("unsupported");
      }
    });
  },
  async requestCamera() {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    return granted ? "granted" : "denied";
  },
  get Scene(): ComponentType<ArSceneProps> | null {
    if (sceneMemo === undefined) {
      const viro = loadViro();
      sceneMemo = viro ? createViroArScene(viro as ViroApi) : null;
    }
    return sceneMemo;
  },
};
