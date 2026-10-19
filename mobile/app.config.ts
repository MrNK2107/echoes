import type { ConfigContext, ExpoConfig } from "expo/config";

// Single source of truth for Expo config (app.json was removed).
// One camera string for photos and camera AR (ADR-0010).
const CAMERA_PERMISSION =
  "ECHOES uses the camera to attach photos to your memories and to show memories around you in AR.";
const MICROPHONE_PERMISSION = "ECHOES records voice notes for your memories.";

// Sentry's plugin only wires native build phases and source-map upload; add it only when the
// owner has configured an org and project so `expo export` and Expo Go need no account (ADR-0011).
function sentryPlugin(): [string, Record<string, unknown>][] {
  const organization = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  return organization && project ? [["@sentry/react-native/expo", { organization, project }]] : [];
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  return {
    ...config,
    name: "ECHOES",
    slug: "echoes",
    scheme: "echoes",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mrnk2107.echoes",
      infoPlist: { NSCameraUsageDescription: CAMERA_PERMISSION },
      config: { usesNonExemptEncryption: false },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
            NSPrivacyAccessedAPITypeReasons: ["C617.1"],
          },
        ],
      },
    },
    android: {
      package: "com.phantom.echoes",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.POST_NOTIFICATIONS",
      ],
      // Dependencies (dev client, audio) can merge these in; the app never needs either.
      blockedPermissions: [
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      ],
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      ...(mapsKey ? { config: { googleMaps: { apiKey: mapsKey } } } : {}),
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-status-bar",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "ECHOES uses your location to find and pin memories near you.",
          // Foreground use only: no always-on location, background mode or motion activity.
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          motionUsagePermission: false,
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
          isAndroidMotionActivityEnabled: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "ECHOES lets you attach photos to your memories.",
          cameraPermission: CAMERA_PERMISSION,
        },
      ],
      ["expo-notifications", { color: "#58A6FF" }],
      [
        "expo-audio",
        {
          microphonePermission: MICROPHONE_PERMISSION,
          // Voice notes play and record in the foreground only (no UIBackgroundModes, no foreground service).
          enableBackgroundPlayback: false,
          enableBackgroundRecording: false,
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: CAMERA_PERMISSION,
          // Camera AR never records video, so expo-camera must not add RECORD_AUDIO or its own mic string.
          microphonePermission: MICROPHONE_PERMISSION,
          recordAudioAndroid: false,
          barcodeScannerEnabled: false,
        },
      ],
      // Attitude (DeviceMotion) needs no permission; disabling the pedometer keeps NSMotionUsageDescription out.
      ["expo-sensors", { motionPermission: false }],
      ...sentryPlugin(),
    ],
    ...(projectId ? { extra: { eas: { projectId } } } : {}),
  };
};
