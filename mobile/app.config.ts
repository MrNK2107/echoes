import type { ConfigContext, ExpoConfig } from "expo/config";

// Single source of truth for Expo config (app.json was removed).
const CAMERA_PERMISSION =
  "ECHOES uses the camera to attach photos to your memories and to show memories around you in AR.";

// Viro is a native module; include its plugin only once the package is installed
// so `expo export` and Expo Go keep working without it.
function viroPlugin(): [string, Record<string, unknown>][] {
  try {
    require.resolve("@reactvision/react-viro/package.json");
  } catch {
    return [];
  }
  return [
    [
      "@reactvision/react-viro",
      {
        android: { xRMode: ["AR"] },
        ios: { cameraUsagePermission: CAMERA_PERMISSION },
      },
    ],
  ];
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
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
    },
    android: {
      package: "com.phantom.echoes",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.POST_NOTIFICATIONS",
      ],
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
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
      ...viroPlugin(),
    ],
    ...(projectId ? { extra: { eas: { projectId } } } : {}),
  };
};
